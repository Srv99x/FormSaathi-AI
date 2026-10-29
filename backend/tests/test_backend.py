from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.models.contracts import Candidate
from app.schemas.registry import get_form
from app.services.session_service import correct
from app.services.validators import check_field

REG = "student_registration_v1"
ASSIST = "student_assistance_v1"
REQUIRED = {
    REG: ["full_name", "date_of_birth", "mobile", "city", "state", "programme"],
    ASSIST: ["full_name", "date_of_birth", "mobile", "institution", "programme",
             "year_of_study", "city", "state", "assistance_type"],
}
FIELDS = {
    REG: ["full_name", "date_of_birth", "mobile", "email", "city", "state", "programme",
          "institution", "guardian_name", "preferred_language"],
    ASSIST: ["full_name", "date_of_birth", "mobile", "email", "institution", "programme",
             "year_of_study", "city", "state", "assistance_type", "support_reason"],
}
VALUES = {"full_name": "Aditi Sen", "date_of_birth": "2006-04-03", "mobile": "9876543210",
          "city": "Guwahati", "state": "Assam", "programme": "BCA",
          "institution": "Demo College", "year_of_study": 2, "assistance_type": "books"}


def new(client, form=REG, locale="en-IN"):
    response = client.post("/api/sessions", json={"form_id": form, "locale": locale})
    assert response.status_code == 201
    return "/api/sessions/" + response.json()["session_id"]


def patch(client, url, key, value):
    response = client.patch(url + "/fields", json={"field_id": key, "value": value, "source": "manual"})
    assert response.status_code == 200
    return response.json()


def complete(client, url, form=REG):
    for key in REQUIRED[form]:
        patch(client, url, key, VALUES[key])


@pytest.mark.parametrize("form", [REG, ASSIST])
def test_exact_forms(client, form):
    fields = client.get("/api/forms/" + form).json()["fields"]
    assert [f["field_id"] for f in fields] == FIELDS[form]
    assert {f["field_id"]: f["required"] for f in fields} == {k: k in REQUIRED[form] for k in FIELDS[form]}
    specs = {f["field_id"]: f for f in fields}
    assert specs["programme"]["enum"] == ["BSc Physics", "BCA", "BA English", "Other"]
    assert specs["state"]["enum"] == ["Assam", "Manipur", "Meghalaya", "Tripura", "Arunachal Pradesh", "Nagaland", "Mizoram", "Other Indian State/UT"]
    assert specs["full_name"]["minLength"] == 2 and specs["full_name"]["maxLength"] == 80
    if form == ASSIST:
        assert specs["year_of_study"]["type"] == "integer"
        assert specs["year_of_study"]["minimum"] == 1 and specs["year_of_study"]["maximum"] == 5
        assert specs["assistance_type"]["enum"] == ["books", "transport", "fees", "other"]
    else:
        assert specs["preferred_language"]["enum"] == ["English", "Hindi", None]


def test_health_list_unknown_form(client):
    assert client.get("/api/health").json()["speech_provider"] == "unavailable"
    assert {x["id"] for x in client.get("/api/forms").json()["forms"]} == {REG, ASSIST}
    assert client.get("/api/forms/nope").status_code == 404
    assert client.post("/api/sessions", json={"form_id": "nope", "locale": "en-IN"}).status_code == 404


@pytest.mark.parametrize("locale,code", [("en-IN",201),("hi-IN",201),("as-IN",400),("en",400),("",400),("EN-IN",400)])
def test_locales(client, locale, code):
    assert client.post("/api/sessions", json={"form_id": REG, "locale": locale}).status_code == code


def test_isolation_expiry_delete(client, clock, store):
    a, b = new(client), new(client)
    assert a != b
    patch(client, a, "full_name", "Aditi Sen")
    assert client.get(b + "/review").json()["values"]["full_name"] is None
    clock[0] += 3599
    assert client.get(a + "/review").status_code == 200
    clock[0] += 1
    assert client.get(a + "/review").status_code == 404
    assert not store.sessions
    c = new(client)
    assert client.delete(c).status_code == 204
    assert client.get(c + "/review").status_code == 404
    assert client.post(c + "/confirm", json={"reviewed":True,"revision":0}).status_code == 404


@pytest.mark.parametrize("form", [REG, ASSIST])
@pytest.mark.parametrize("blank", [None, "", " \t ", "unknown"])
def test_required_missing(client, form, blank):
    url = new(client, form)
    result = client.post(url + "/validate", json={"proposed_values":dict.fromkeys(REQUIRED[form], blank)}).json()
    assert result["missing"] == REQUIRED[form]
    assert not result["can_confirm"]
    assert all(result["messages"][key] for key in FIELDS[form])


@pytest.mark.parametrize("mobile,valid", [("9876543210",True),("+91 98765-43210",True),
    ("6123456789",True),("12345",False),("2123456789",False),("98765432100",False),
    ("919876543210",False),("+1 9876543210",False),("९८७६५४३२१०",False),(9876543210,False)])
def test_mobile(client, mobile, valid):
    result = patch(client, new(client), "mobile", mobile)
    assert (result["status"] == "valid") == valid
    if valid:
        assert len(result["field"]["value"]) == 10


@pytest.mark.parametrize("dob,status", [("2006-04-03","valid"),("3 April 2006","valid"),
    ("03/04/2006","needs_review"),("31/02/2006","invalid"),("2006-02-29","invalid"),
    ("tomorrow","invalid"),("2006-4-3","invalid"),("3000-01-01","invalid")])
def test_dates(client, dob, status):
    assert patch(client, new(client), "date_of_birth", dob)["status"] == status


def test_age_outlier_requires_explicit_check():
    spec = get_form(REG)["properties"]["date_of_birth"]
    value = "2020-01-01"
    assert check_field("date_of_birth",value,spec,True,date(2026,10,29))[1] == "needs_review"
    assert check_field("date_of_birth",value,spec,True,date(2026,10,29),True)[1] == "valid"
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    assert check_field("date_of_birth",tomorrow,spec,True,date.today(),True)[1] == "invalid"


@pytest.mark.parametrize("key,value", [("email","bad@"),("programme","Engineering"),
    ("state","Delhi"),("institution","A"),("guardian_name","A"),("preferred_language","Assamese")])
def test_optional_and_enums(client, key, value):
    assert patch(client,new(client),key,value)["status"] == "invalid"


@pytest.mark.parametrize("year", [0,6,2.5,"2",True])
def test_invalid_year(client, year):
    url = new(client,ASSIST)
    response = client.patch(url+"/fields",json={"field_id":"year_of_study","value":year,"source":"manual"})
    assert response.status_code == 422 or response.json()["status"] == "invalid"


def test_optional_valid_and_unicode(client):
    url = new(client)
    assert patch(client,url,"email","aditi@example.org")["status"] == "valid"
    assert patch(client,url,"email","")["status"] == "empty"
    assert patch(client,url,"full_name","  पूजा   दास  ")["field"]["value"] == "पूजा दास"
    assert patch(client,url,"programme","bca")["field"]["value"] == "BCA"


def test_unknown_fields_atomic_and_no_inference(client):
    url = new(client)
    assert client.post(url+"/validate",json={"proposed_values":{"city":"Guwahati","gender":"X"}}).status_code == 422
    result = client.get(url+"/review").json()
    assert result["revision"] == 0 and result["values"]["city"] is None
    assert client.patch(url+"/fields",json={"field_id":"phone_number","value":"123","source":"manual"}).status_code == 422
    patch(client,url,"city","Guwahati")
    assert client.get(url+"/review").json()["values"]["state"] is None


@pytest.mark.parametrize("form", [REG, ASSIST])
def test_confirm_review_revision_and_edit(client, form):
    url = new(client,form)
    complete(client,url,form)
    revision = len(REQUIRED[form])
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":revision}).status_code == 409
    review = client.get(url+"/review").json()
    assert review["can_confirm"]
    assert client.post(url+"/confirm",json={"reviewed":False,"revision":revision}).status_code == 409
    response = client.post(url+"/confirm",json={"reviewed":True,"revision":revision})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "confirmed_local" and result["record"] == review["values"]
    assert set(result["record"]) == set(FIELDS[form])
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":revision}).json() == result
    patch(client,url,"full_name","Aditi Roy")
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":revision}).status_code == 409
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":revision+1}).status_code == 409
    client.get(url+"/review")
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":revision+1}).json()["record"]["full_name"] == "Aditi Roy"


@pytest.mark.parametrize("problem,value", [("mobile","12345"),("date_of_birth","03/04/2006"),("email","bad"),("full_name"," ")])
def test_invalid_incomplete_uncertain_confirmation(client, problem, value):
    url = new(client)
    complete(client,url)
    patch(client,url,problem,value)
    review = client.get(url+"/review").json()
    assert not review["can_confirm"]
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":review["revision"]}).status_code == 409


def test_empty_confirmation(client):
    url = new(client)
    client.get(url+"/review")
    assert client.post(url+"/confirm",json={"reviewed":True,"revision":0}).status_code == 409


def test_proposals_conflict_manual_preserved(client):
    url = new(client)
    result = client.post(url+"/validate",json={"proposed_values":{"full_name":"Aditi Sen"}}).json()
    assert result["statuses"]["full_name"] == "needs_review"
    patch(client,url,"full_name","Aditi Roy")
    client.get(url+"/review")
    result = client.post(url+"/validate",json={"proposed_values":{"full_name":"Aditi Sen"}}).json()
    assert result["values"]["full_name"] == "Aditi Roy"
    assert result["statuses"]["full_name"] == "conflict"
    assert result["conflicts"][0]["candidates"] == ["Aditi Roy","Aditi Sen"]
    assert patch(client,url,"full_name","Aditi Roy")["status"] == "valid"
    assert client.get(url+"/review").json()["conflicts"] == []


def test_unavailable_ai_no_mutation(client):
    url = new(client,locale="hi-IN")
    assert client.post(url+"/speech").status_code == 503
    response = client.post(url+"/extract",json={"transcript":"मेरा नाम पूजा है", "language_code":"hi-IN"})
    assert response.status_code == 503 and response.json()["error"]["code"] == "EXTRACTION_UNAVAILABLE"
    for transcript, locale, code in [(" ","hi-IN",400),("test","as-IN",400),("test","en-IN",400)]:
        assert client.post(url+"/extract",json={"transcript":transcript,"language_code":locale}).status_code == code
    assert client.get(url+"/review").json()["revision"] == 0
    assert client.post("/api/sessions/missing/speech").status_code == 404


def test_contract_errors_and_candidate_metadata(client):
    candidate = {"field_id":"full_name","value":"पूजा","evidence_text":"पूजा","uncertain":True,"ambiguity_reason":"Check spelling"}
    assert Candidate.model_validate(candidate).model_dump() == candidate
    for key in ["field_id","value","evidence_text","uncertain","ambiguity_reason"]:
        with pytest.raises(ValidationError):
            Candidate.model_validate({k:v for k,v in candidate.items() if k != key})
    url = new(client)
    result = client.patch(url+"/fields",json={"field_id":"full_name","value":{"secret":"PII"},"source":"manual"})
    assert result.status_code == 422 and "PII" not in result.text
    assert set(result.json()["error"]) == {"code","message","retryable","field_id","request_id"}
    assert client.post(url+"/confirm",json={"reviewed":"true","revision":0}).status_code == 422


def test_atomic_revisions(store):
    session = store.create(REG,"en-IN")
    def edit(index):
        with store.access(session.session_id) as current:
            correct(current,"full_name",f"Synthetic {index}")
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(edit,range(20)))
    assert session.revision == 20 and session.reviewed_revision is None


def test_openapi_and_cors(client):
    spec = client.get("/openapi.json").json()
    assert "multipart/form-data" in spec["paths"]["/api/sessions/{sid}/speech"]["post"]["requestBody"]["content"]
    good = client.options("/api/forms",headers={"Origin":"http://localhost:5173","Access-Control-Request-Method":"GET"})
    assert good.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options("/api/forms",headers={"Origin":"https://untrusted.example","Access-Control-Request-Method":"GET"})
    assert "access-control-allow-origin" not in bad.headers
