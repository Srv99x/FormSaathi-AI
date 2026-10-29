# FormSaathi AI — Deployment Guide

This guide details how to deploy FormSaathi AI with the **FastAPI Backend on Render** and the **React Vite Frontend on Vercel**.

---

## 1. Backend Deployment (Render)

Render hosts the Python FastAPI application with automated health checks and environment variable management.

### Option A: Automatic Blueprint Deployment (Recommended)
1. Push your code to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](../render.yaml).
4. Supply your secret keys when prompted:
   - `SARVAM_API_KEY`: Your Sarvam AI key (speech-to-text)
   - `GROQ_API_KEY`: Your Groq Cloud API key (LLM entity extraction)
5. Click **Apply**. Render will build and deploy the web service.

### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Name**: `formsaathi-backend`
   - **Region**: Any (e.g., `Oregon (US West)` or `Singapore`)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/health`
4. Under **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.12.9`
   - `CORS_ORIGINS`: `https://*.vercel.app,http://localhost:5173` (or `*`)
   - `SARVAM_API_KEY`: *(your Sarvam API key)*
   - `GROQ_API_KEY`: *(your Groq API key)*
5. Click **Create Web Service**.
6. Once deployed, copy your Render URL: e.g. `https://formsaathi-backend.onrender.com`.

---

## 2. Frontend Deployment (Vercel)

Vercel hosts the React Single-Page Application (SPA) with automated build optimization and CDN caching.

### Step-by-Step Vercel Setup
1. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** → **Project**.
2. Import your GitHub repository.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and choose `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: Your Render backend URL from Step 1 (e.g., `https://formsaathi-backend.onrender.com`)
5. Click **Deploy**.
6. Vercel will build the frontend and provide a live URL (e.g. `https://formsaathi-ai.vercel.app`).

---

## 3. Post-Deployment Verification

1. **Verify Backend Health**:
   ```bash
   curl https://<your-render-app>.onrender.com/api/health
   ```
   Expected response:
   ```json
   {"status":"ok","speech_provider":"available","extraction_provider":"available"}
   ```

2. **Verify Frontend**:
   - Open your Vercel URL in a desktop or mobile browser.
   - Navigate to `/form/student_registration_v1`.
   - Test clicking the voice assistant button on the bottom right corner.
   - Verify speech recording and form auto-filling interact smoothly with the Render backend.

---

## 4. Local Development

Both services remain fully functional for local development:
- **Backend**:
  ```powershell
  Set-Location backend
  .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  ```
- **Frontend**:
  ```powershell
  Set-Location frontend
  npm run dev
  ```
  Vite's proxy routes `/api` directly to `127.0.0.1:8000`.

