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

The static prototype groups its HTML screens by section under `screens/`, with
one shared `styles.css` and `app.js` in the repository root. Open `index.html`
for a screen directory with links to each page. Sections 1–7, the mobile screens
in Section 8, and the overlays in Section 9 are kept separate. The prototype
uses placeholder text and does not connect to a backend.

The sign-in flow uses local UI state only. It does not authenticate users,
create accounts, or send password-reset emails. Enter `pending@demo.local` with
any non-empty password on the sign-in screen to preview the pending-approval
state. The dashboard screens use sample placeholder content.

### Screen groups

- [Sections 1–7: sign-in and main app](./screens/section-1-7/)
- [Section 8: mobile app screens](./screens/section-8-mobile/)
- [Section 9: overlay screens](./screens/section-9-overlays/)

To run locally, start a static server from the repository root, for example
`python -m http.server 8000`, then open `http://localhost:8000`.

### Django template test frontend

A Django-rendered version of the screens is available in
[django_frontend](./django_frontend/). It keeps the applications separate:

- Sections 1–7 are served by `main_screens` at `/`.
- Section 8 mobile screens are served by `mobile_screens` at `/mobile/`.
- Section 9 overlays are served by `overlay_screens` at `/overlays/`.

The mobile and overlay apps have their own route namespaces and template
directories; neither is included in the Sections 1–7 navigation. These are
independent UI test screens, not a production authentication or data backend.

Use Python 3.12 or newer, then run in PowerShell:

```powershell
cd django_frontend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py runserver
```

Open `http://127.0.0.1:8000/` for Sections 1–7,
`http://127.0.0.1:8000/mobile/` for the mobile app, or
`http://127.0.0.1:8000/overlays/` for the separate overlays. The organized
static prototype is available from the repository root `index.html`.
