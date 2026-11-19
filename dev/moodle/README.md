# Test Moodle

A Moodle 4.4 on your own machine (the version Strathmore's Data Science Centre runs), for testing Study Buddy's LTI launch. Docker runs Moodle and its database together, and ngrok puts it on a fixed public HTTPS address so Study Buddy on Vercel can reach it. It keeps its data between runs and is online while Docker is running.

## One-time setup

1. **ngrok** (free): sign up at [dashboard.ngrok.com](https://dashboard.ngrok.com). Copy your **Authtoken**, and under **Domains** claim your free fixed domain.
2. Copy `.env.example` to `.env` in this folder and fill in both values.
3. Download Moodle's code into Docker's storage (about two minutes), from this folder. It isn't kept in this folder: Docker on Windows reads files from a Windows folder so slowly that the install would take an hour and every page would crawl.
   ```bash
   docker compose run --rm code
   ```
4. Start it:
   ```bash
   docker compose up -d --wait
   ```
5. Add an admin password to `.env` as `MOODLE_ADMIN_PASSWORD=<password>` (it needs a capital, a small letter, a digit and a symbol), then install Moodle (once, about four minutes):
   ```bash
   docker compose exec -u www-data moodle php admin/cli/install_database.php --agree-license --fullname="Study Buddy test Moodle" --shortname="Study Buddy test" --adminuser=admin --adminpass="$(grep '^MOODLE_ADMIN_PASSWORD=' .env | cut -d= -f2-)" --adminemail=murayinnovations@gmail.com
   ```
6. Open `https://<your ngrok domain>` and sign in as `admin` with that password. ngrok shows a one-time warning page first on the free plan; click **Visit Site**.

Always open Moodle through the ngrok address, not `localhost`: Moodle only answers on the address it was installed with.

## Every day

```bash
docker compose up -d     # start
docker compose stop      # stop; everything is kept
docker compose down -v   # delete everything, including Moodle's database and code, to start again from step 3
```

## Testing Study Buddy

Study Buddy must be deployed (Moodle only talks to HTTPS addresses), and you must be an admin in Study Buddy.

Steps 1, 2 and 6 can be done in one go: after the tool is registered and activated (steps 3 to 5), create the student and teacher users in Moodle, then build the course from a Study Buddy course folder (the one `scripts/import-course.mjs` reads). It makes one section per week with the course's files, enrols the two users, adds the Study Buddy activity with the right `course=` code, and sets the tool to share name and email and open in a new window. Running it again replaces the course.

```bash
sh setup-course.sh ../../imports/raw/pbi88 <student username> <teacher username>
```

1. **Test people:** in Moodle, **Site administration → Users → Add a new user**: one student and one teacher, with real inboxes or Gmail `+` addresses (e.g. `murayinnovations+student@gmail.com`).
2. **Test course:** **Site administration → Courses → Add a new course**, then enrol the student as Student and the teacher as Teacher (course → **Participants → Enrol users**).
3. **Register Study Buddy:** **Site administration → Plugins → Activity modules → External tool → Manage tools**. Paste `https://<study-buddy-domain>/lti/register` into **Tool URL** and click **Add LTI Advantage**. Then click **Activate** on the new tool.
4. **Approve it:** you get an email; sign in to Study Buddy as an admin and approve the ngrok address.
5. **Tool settings** (the cog on the tool in Manage tools): **Share launcher's name with tool** and **Share launcher's email with tool** set to **Always**, **Default launch container** set to **New window**.
6. **Add the activity:** as the teacher, in the course turn on **Edit mode**, **Add an activity or resource → Study Buddy**. Under **Show more… → Custom parameters** enter `course=BI-Apr-26`.
7. **Launch:** sign in as the student and click the activity. Study Buddy should open in a new tab, signed in, on the Power BI course. Then try the teacher.

## Chat button

`chat-button.html` adds an **Ask Study Buddy** button in the bottom-right corner of every page inside a course that has a Study Buddy activity. It opens Study Buddy in a new tab, the same launch as clicking the activity; it is a link, not a chat inside Moodle. To install it, paste the file's contents into **Site administration → Appearance → Additional HTML → Before BODY is closed**, or from this folder:

```bash
docker compose cp chat-button.html moodle:/tmp/chat-button.html
docker compose exec -u www-data moodle php -r 'define("CLI_SCRIPT", true); require "/var/www/html/config.php"; set_config("additionalhtmlfooter", file_get_contents("/tmp/chat-button.html"));'
```

It finds the activity by name, so the activity's name must include "Study Buddy". On a real university's Moodle, this is a site-wide setting their administrator would add.

ngrok's request inspector at http://localhost:4040 shows every request between Moodle and Study Buddy, which helps when something fails.
