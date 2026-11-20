# Technological University of the Philippines  
## System Analysis and Design  

### Professor  
**Prof. PERAGRINO B. AMADOR JR**

### Section  
**BSIS - 3A**

### Team Information  
- **Team Number:** Team #8  
- **Team Leader:** JAE MARVIN L. SALAZAR  
- **Members:**  
  - EMMANUEL M. CARURUCAN 
  - ARMHEL G. MAYAO
  - MARC IÑIGO P. OROZCO  
  - RHEINWELL Q. PALOMARES  

## Instructional Materials  

- **Web App:** [BSIS Agile SAD Curriculum](https://tupcossad.netlify.app/)
- **Google Drive:** [Access Materials Here](https://drive.google.com/drive/folders/1e6S8s2XvSlx_qyoAlUGewRo02ndxR-e3?usp=drive_link)

## UI prototype

The static prototype groups the main-system screens from Sections 1–7 under
`screens/section-1-7/`. The mobile companion keeps its Section 8 screens and
Section 9 overlays together under `screens/mobile-companion/`. Both use the
shared `styles.css` and `app.js` at the repository root. Open `index.html` for a
screen directory grouped by main system and mobile companion. Screen copy is
based on the supplied high-fidelity references. Lists, metrics, and product
catalogs use empty states until connected to live data. The separate
`High Fidelity/` prototype has its own renderer and styles.
The prototypes use Shrikhand headings, Poppins body text, the supplied brand
palette, and the `download.jpg` Second Daze Apparel logo.

The sign-in flow uses local UI state only; it is not production authentication
and does not create accounts or send password-reset emails. Use username
`admin` and password `admin` for the temporary dashboard preview. Enter
`pending@demo.local` with any non-empty password to preview the
pending-approval state. Dashboard metrics, records, and product listings remain
empty until connected to live data.

### Screen groups

- [Main system: Sections 1–7](./screens/section-1-7/)
- [Mobile companion: Section 8 screens](./screens/mobile-companion/section-8-mobile/)
- [Mobile companion: Section 9 overlays](./screens/mobile-companion/section-9-overlays/)

To run locally, start a static server from the repository root, for example
`python -m http.server 8000`, then open `http://localhost:8000`.

### Django template test frontend

A Django-rendered version of the screens is available in
[django_frontend](./django_frontend/). The main-system and mobile-companion
areas are separate:

- The main system (Sections 1–7) is served by `main_screens` at `/`.
- Section 8 mobile screens are served by `mobile_screens` at `/mobile/`.
- Section 9 mobile overlays are served by `overlay_screens` at
  `/mobile/overlays/` and are linked from the mobile companion.

Mobile overlays return to their corresponding mobile screen when closed; the
main-system navigation remains limited to Sections 1–7. These are UI test
screens, not a production authentication or data backend.

#### Quick start on Windows

Double-click [run-django.bat](./run-django.bat) from the repository root. It
creates a virtual environment and installs Django on first run, starts the
development server, then opens the browser when the site is ready. Keep the
terminal window open during testing; press **Ctrl+C** there to stop the server.
If port 8000 is already serving locally, the script opens that server instead.

#### Manual start

```powershell
cd django_frontend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py runserver
```

Open `http://127.0.0.1:8000/` for sign-in, `http://127.0.0.1:8000/screens/`
for the complete screen directory, `http://127.0.0.1:8000/2-admin-dashboard/` for Sections 1–7,
`http://127.0.0.1:8000/mobile/` for the mobile companion, or
`http://127.0.0.1:8000/mobile/overlays/` for its overlays. The organized static
prototype is available from the repository root `index.html`.

### React + Vite comparison frontend

The independent React + Vite version is in
[react_frontend](./react_frontend/). It keeps the Sections 1–7 main system
separate from the Section 8 mobile companion and Section 9 overlays, and does
not modify or replace the Django frontend.

#### Quick start on Windows

Install [Node.js](https://nodejs.org/) if it is not already available, then run
these commands from the repository root:

```powershell
cd react_frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally
`http://127.0.0.1:5173/`). The React app opens on its dashboard; select
**Screen index** in the sidebar to browse the available screens. Leave the
terminal open while testing and press **Ctrl+C** to stop the server. Run Django
separately at `http://127.0.0.1:8000/` when comparing the two frontends.

To verify a production build, run `npm run build` inside `react_frontend/`.
The generated site is written to `react_frontend/dist/`. Like the Django
prototype, this is a UI-only comparison: authentication, form submissions,
reports, metrics, and records are not backed by a database.
