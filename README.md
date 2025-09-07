# Here are your Instructions
# N.A.H. Project

This application consists of a **FastAPI** backend and a **React** frontend. The backend exposes location services while the React app serves the user interface.

## Environment configuration
Create the following `.env` files before starting the project:

### `backend/.env`
```
MONGO_URL=<your Mongo connection string>
GOOGLE_PLACES_API_KEY=<your Google Places API key>
OPENAI_API_KEY=<your OpenAI key>
```

### `frontend/.env`
```
WDS_SOCKET_PORT=<port for the dev server>
REACT_APP_BACKEND_URL=<URL of the backend>
```
These files hold credentials that are required by the services.

## Local start with Docker
Both services can be launched with Docker using the provided `Dockerfile` and `entrypoint.sh`.
Run the following commands from the repository root:

```bash
docker build -t nah-app .
docker run --env-file backend/.env --env-file frontend/.env -p 80:80 -p 8001:8001 nah-app
```
The entrypoint script starts the FastAPI server with Uvicorn and serves the built frontend via Nginx.

## Development without Docker
For development you can start each service separately.

### Backend
```bash
cd backend
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn start
```

## Tests
A script called `backend_test.py` exists to run basic API tests. Additional `pytest` tests are planned under `tests/`.
