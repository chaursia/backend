const express = require('express');
const router = express.Router();

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ITS Backend API Documentation</title>
    <style>
        :root { --bg-color: #0f172a; --text-color: #cbd5e1; --card-bg: #1e293b; --accent: #38bdf8; --border: #334155; --method-get: #10b981; --method-post: #f59e0b; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background-color: var(--bg-color); color: var(--text-color); margin: 0; padding: 2rem; line-height: 1.6; }
        h1 { color: #f8fafc; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; font-size: 2.5rem; }
        .container { max-width: 900px; margin: 0 auto; }
        .endpoint { background-color: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .endpoint h3 { margin-top: 0; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
        .method { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.9rem; font-weight: bold; color: #fff; }
        .get { background-color: var(--method-get); } .post { background-color: var(--method-post); }
        .path { font-family: monospace; color: var(--accent); font-size: 1.2rem; }
        .description { margin: 1rem 0; }
        .headers, .params { background-color: #0f172a; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); margin-top: 1rem; }
        .headers p, .params p { margin: 0 0 0.5rem 0; font-weight: bold; color: #94a3b8; }
        code { color: #f472b6; font-family: monospace; background: #334155; padding: 2px 4px; border-radius: 4px; }
        details { background-color: #0f172a; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); margin-top: 1rem; }
        summary { cursor: pointer; font-weight: bold; color: var(--accent); outline: none; }
        pre { margin: 1rem 0 0 0; white-space: pre-wrap; background: #1e293b; padding: 1rem; border-radius: 6px; border: 1px solid #334155; color: #e2e8f0; font-size: 0.9rem; overflow-x: auto; }
        pre code { color: inherit; background: transparent; padding: 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ITS Backend API Docs</h1>
        <p>Welcome to the official API documentation. Base URL is the root of this server.</p>

        <!-- Auth Endpoints -->
        <h2>Authentication</h2>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span> <span class="path">/auth/login</span></h3>
            <p class="description">Authenticates a user via the college system and returns an encrypted session token.</p>
            <div class="params">
                <p>Body Parameters (JSON):</p>
                <code>email</code>: College email address<br>
                <code>password</code>: College password
            </div>
            <div class="headers">
                <p>Returns:</p>
                <code>sessionId</code>: You must pass this exact string as <code>x-session-id</code> header in all <span class="path">/api/*</span> requests!
            </div>
            <details>
                <summary>View Example Response</summary>
<pre><code>{
  "message": "Login successful",
  "sessionId": "a1b2c3d4e5f6:34f590babcde12345..."
}</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method post">POST</span> <span class="path">/auth/logout</span></h3>
            <p class="description">Terminates the local frontend session logic.</p>
            <details>
                <summary>View Example Response</summary>
<pre><code>{
  "message": "Logged out successfully"
}</code></pre>
            </details>
        </div>

        <!-- College API Endpoints -->
        <h2>College Data Endpoints</h2>
        <p><i>⚠️ All endpoints below <strong>require</strong> the <code>x-session-id</code> header mapping to your login token.</i></p>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/profile</span></h3>
            <p class="description">Fetches the securely authenticated student's full profile and demographic information.</p>
            <details>
                <summary>View Exact Personal Response Data</summary>
<pre><code>${JSON.stringify("{\n  \"success\": true,\n  \"message\": \"Success\",\n  \"data\": {\n    \"_id\": \"68d6\",\n    \"studentId\": \"\",\n    \"fullName\": \"DIVYANSHU CHARUSIA\",\n    \"firstName\": \"DIVYANSHU\",\n    \"lastName\": \"CHARUSIA\",\n    \"email\": \"\",\n    \"userType\": 1,\n    \"dob\": \"2008-09-28T18:30:00.000Z\",\n    \"mobile\": \"\",\n    \"gender\": \"M\",\n    \"category\": \"General\",\n    \"religion\": \"Hinduism\",\n    \"rollNo\": \"2502220100309\",\n    \"personalEmail\": \"\",\n    \"adharcardNo\": \"\",\n    \"pancardNo\": \"\",\n    \"enrollmentNo\": \"\",\n    \"course\": {\n      \"_id\": \"644a12a454180d10c4f7239d\",\n      \"courseNickName\": \"B.Tech\",\n      \"courseFullName\": \"Bachelor of Technology\"\n    },\n    \"branch\": {\n      \"_id\": \"65900f46f0b570dad47ea562\",\n      \"branchNickName\": \"ASH\",\n      \"branchFullName\": \"Applied Science And Humanities\"\n    },\n    \"admissionYear\": 2025,\n    \"admissionDate\": \"2025-06-30T18:30:00.000Z\",\n    \"modeOfAdmission\": \"Direct\",\n    \"markOfidentification\": \"\",\n    \"fatherName\": \"\",\n    \"fatherMobileNo\": \"\",\n    \"fatherOccupation\": \"Service\",\n    \"fatherAnnualIncome\": 0,\n    \"fatherPancardNo\": \"\",\n    \"fatherImage\": \"\",\n    \"motherName\": \"\",\n    \"motherOccupation\": \"HouseWife\",\n    \"motherMobileNo\": \"\",\n    \"motherPancardNo\": \"\",\n    \"motherImage\": \"\",\n    \"localAddressLine1\": \"\",\n    \"localAddressLine2\": \"\",\n    \"localAddressCity\": \"\",\n    \"localAddressState\": \"\",\n    \"localAddressZipCode\": \"\",\n    \"localAddressCountry\": \"\",\n    \"permanentAddressLine1\": \"\",\n    \"permanentAddressLine2\": \"\",\n    \"permanentAddressCity\": \"\",\n    \"permanentAddressState\": \"\",\n    \"permanentAddressZipCode\": \"\",\n    \"permanentAddressCountry\": \"\",\n    \"department\": {\n      \"_id\": \"6450fbd31d9bada7ea515664\"\n    },\n    \"picture\": \"\",\n    \"firstLogin\": false,\n    \"isLoggedIn\": true,\n    \"lastLogin\": \"2026-04-01T14:28:38.951Z\",\n    \"notificationEnabled\": true,\n    \"isPasswordChanged\": true,\n    \"currentSession\": \"2025-2026\",\n    \"currentYear\": 1,\n    \"currentSemester\": 2,\n    \"currentSection\": \"E\",\n    \"currentGroup\": \"G1\",\n    \"studentStage\": \"Pursuing\",\n    \"isViaSemRegistered\": false,\n    \"isGlobalViaSemRegistered\": true,\n    \"updated_at\": \"2026-04-01T14:28:38.953Z\",\n    \"created_at\": \"2025-09-27T10:03:43.260Z\"\n  }\n}", null, 2)}</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/attendance/overall</span></h3>
            <p class="description">Retrieves the total consolidated academic attendance statistics for the current student.</p>
            <details>
                <summary>View Exact Personal Response Data</summary>
<pre><code>${JSON.stringify("{\n  \"success\": true,\n  \"message\": \"Success\",\n  \"data\": [\n    {\n      \"SN\": 1,\n      \"subjectId\": \"67eb9436e7a8b14b22875d8b\",\n      \"subjectCode\": \"BAS205\",\n      \"subjectName\": \"Soft Skill\",\n      \"lectureType\": \"Lecture\",\n      \"subjectTotalClassesAttended\": 10,\n      \"subjectTotalClassesHeld\": 23,\n      \"subjectTotalPercentage\": 43.48\n    },\n    {\n      \"SN\": 2,\n      \"subjectId\": \"67eb9436e7a8b14b22875d88\",\n      \"subjectCode\": \"BAS202\",\n      \"subjectName\": \"Engineering Chemistry\",\n      \"lectureType\": \"Lecture\",\n      \"subjectTotalClassesAttended\": 14,\n      \"subjectTotalClassesHeld\": 32,\n      \"subjectTotalPercentage\": 43.75\n    }\n  ]\n}", null, 2)}</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/attendance/monthly</span></h3>
            <p class="description">Retrieves attendance breakdown mapped specifically to a single month.</p>
            <div class="params">
                <p>Query Parameters:</p>
                <code>month</code> (required): Numeric month string (e.g., "04" for April)<br>
                <code>session</code> (optional): Defaults to "2025-2026"
            </div>
            <details>
                <summary>View Exact Personal Response Data</summary>
<pre><code>${JSON.stringify("{\n  \"success\": true,\n  \"message\": \"Success\",\n  \"data\": [\n    {\n      \"attendanceDate\": \"2026-03-16T13:59:59.000Z\",\n      \"attendances\": [\n        {\n          \"_id\": \"69b725153bcb401dba233959\",\n          \"date\": \"2026-03-16T13:59:59.000Z\",\n          \"timetable\": \"09:10-10:05\",\n          \"subject\": \"67eb9436e7a8b14b22875d8b\",\n          \"subjectCode\": \"BAS205\",\n          \"subjectType\": \"Regular\",\n          \"lectureType\": \"Lecture\",\n          \"lectureStatus\": \"Active\",\n          \"currentUser\": {\n            \"_id\": \"66c8333a12a3895cab4dc154\",\n            \"firstName\": \"Shelly \"\n          },\n          \"status\": \"P\"\n        },\n        {\n          \"_id\": \"69b725153bcb401dba23395d\",\n          \"date\": \"2026-03-16T13:59:59.000Z\",\n          \"timetable\": \"10:05-10:55\",\n          \"subject\": \"67eb9436e7a8b14b22875d88\",\n          \"subjectCode\": \"BAS202\",\n          \"subjectType\": \"Regular\",\n          \"lectureType\": \"Lecture\",\n          \"lectureStatus\": \"Active\",\n          \"currentUser\": {\n            \"_id\": \"6892ef00d0e34e2479eb8888\",\n            \"firstName\": \"Neeraj\"\n          },\n          \"status\": \"P\"\n        }\n      ]\n    },\n    {\n      \"attendanceDate\": \"2026-03-19T13:59:59.000Z\",\n      \"attendances\": [\n        {\n          \"_id\": \"69b7251e3bcb401dba234b7f\",\n          \"date\": \"2026-03-19T13:59:59.000Z\",\n          \"timetable\": \"09:10-10:05\",\n          \"subject\": \"67eb9436e7a8b14b22875d8a\",\n          \"subjectCode\": \"BME201\",\n          \"subjectType\": \"Regular\",\n          \"lectureType\": \"Lecture\",\n          \"lectureStatus\": \"Active\",\n          \"currentUser\": {\n            \"_id\": \"68ad50097ad3378ac5474f43\",\n            \"firstName\": \"Dr. Sandeep \"\n          },\n          \"status\": \"P\"\n        },\n        {\n          \"_id\": \"69b7251e3bcb401dba234b83\",\n          \"date\": \"2026-03-19T13:59:59.000Z\",\n          \"timetable\": \"10:05-10:55\",\n          \"subject\": \"67eb9436e7a8b14b22875d92\",\n          \"subjectCode\": \"BWS251\",\n          \"subjectType\": \"Regular\",\n          \"lectureType\": \"Lecture\",\n          \"lectureStatus\": \"Active\",\n          \"currentUser\": {\n            \"_id\": \"65030cfaf12e43bbb52bdf75\",\n            \"firstName\": \"Yogendra\"\n          },\n          \"status\": \"P\"\n        }\n      ]\n    }\n  ],\n  \"lectures\": [],\n  \"presentDays\": 34,\n  \"absentDays\": 4\n}", null, 2)}</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/notifications</span></h3>
            <p class="description">Fetches the latest real-time college notifications and portal alerts.</p>
            <details>
                <summary>View Exact Personal Response Data</summary>
<pre><code>${JSON.stringify("{\n  \"success\": true,\n  \"message\": \"Success\",\n  \"data\": [\n    {\n      \"_id\": \"69cb6d4c34711b5fbd0e2e1e\",\n      \"subject\": \"Second Intimation Regarding Short Attendance \",\n      \"message\": \"ShortAttendanceDetentionLetters\",\n      \"category\": \"WarningLetter\",\n      \"isRead\": false,\n      \"sourceId\": \"69cb6d4c34711b5fbd0e2e16\",\n      \"created_at\": \"2026-03-31T06:44:28.458Z\",\n      \"updated_at\": \"2026-03-31T06:44:28.458Z\"\n    },\n    {\n      \"_id\": \"69afe1de28b1a3081e1a49ab\",\n      \"subject\": \"Detention from ST-1 Examination \",\n      \"message\": \"ShortAttendanceDetentionLetters\",\n      \"category\": \"WarningLetter\",\n      \"isRead\": false,\n      \"sourceId\": \"69afe1de28b1a3081e1a49a3\",\n      \"created_at\": \"2026-03-10T09:18:22.546Z\",\n      \"updated_at\": \"2026-03-10T09:18:22.546Z\"\n    }\n  ],\n  \"totalCount\": 3\n}", null, 2)}</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/timetable</span></h3>
            <p class="description">Retrieves the student's personal weekly course timetable.</p>
            <div class="params">
                <p>Query Parameters:</p>
                <code>session</code> (optional): Defaults to "2025-2026"<br>
                <code>id</code> (optional): Maps to schedule group, defaults to "14"
            </div>
            <details>
                <summary>View Exact Personal Response Data</summary>
<pre><code>${JSON.stringify("{\n  \"success\": true,\n  \"message\": \"Success\",\n  \"data\": [\n    {\n      \"day\": \"Day/Time\",\n      \"weekDay\": \"0\",\n      \"isActive\": true,\n      \"timetables\": [\n        {\n          \"_id\": \"6620e48e0f06c7cbde257f18\",\n          \"course\": \"644a12a454180d10c4f7239d\",\n          \"courseBranch\": \"65900f46f0b570dad47ea562\",\n          \"year\": 1,\n          \"semester\": 2,\n          \"type\": \"Lecture\",\n          \"slotTime\": \"09:10-10:05\",\n          \"unitHours\": 1,\n          \"order\": 1,\n          \"updated_at\": \"2024-04-18T09:14:54.935Z\",\n          \"created_at\": \"2024-04-18T09:14:54.934Z\",\n          \"__v\": 0,\n          \"session\": \"2023-2024\"\n        },\n        {\n          \"_id\": \"6620e52a0f06c7cbde257f2a\",\n          \"course\": \"644a12a454180d10c4f7239d\",\n          \"courseBranch\": \"65900f46f0b570dad47ea562\",\n          \"year\": 1,\n          \"semester\": 2,\n          \"type\": \"Lecture\",\n          \"slotTime\": \"10:05-10:55\",\n          \"unitHours\": 1,\n          \"order\": 2,\n          \"updated_at\": \"2024-04-18T09:17:30.336Z\",\n          \"created_at\": \"2024-04-18T09:17:30.336Z\",\n          \"__v\": 0,\n          \"session\": \"2023-2024\"\n        }\n      ]\n    },\n    {\n      \"day\": \"MON\",\n      \"weekDay\": \"1\",\n      \"isActive\": true,\n      \"timetables\": [\n        {\n          \"isLunch\": false,\n          \"lunchText\": \"\",\n          \"subjectType\": \"Regular\",\n          \"lectures\": [\n            {\n              \"_id\": \"69c99a155d7f570dcc2661f3\",\n              \"userLecture\": \"69806424272aa35ad80a6ca9\",\n              \"session\": \"2025-2026\",\n              \"sessionYear\": 2026,\n              \"course\": {\n                \"_id\": \"644a12a454180d10c4f7239d\",\n                \"courseNickName\": \"B.Tech\",\n                \"courseFullName\": \"Bachelor of Technology\",\n                \"branch\": [\n                  {\n                    \"openingSession\": \"2022-2023\",\n                    \"branchFullName\": \"Civil Engineering\",\n                    \"branchNickName\": \"CE\",\n                    \"branchCode\": \"00\",\n                    \"shift\": \"Morning\",\n                    \"status\": \"Active\",\n                    \"totalIntake\": 30,\n                    \"_id\": \"644a133c54180d10c4f7244d\",\n                    \"programSpecificOutcomes\": []\n                  },\n                  {\n                    \"openingSession\": \"2022-2023\",\n                    \"branchFullName\": \"Computer Science and Engineering\",\n                    \"branchNickName\": \"CSE\",\n                    \"branchCode\": \"10\",\n                    \"shift\": \"Morning\",\n                    \"status\": \"Active\",\n                    \"totalIntake\": 180,\n                    \"_id\": \"644a1b3254180d10c4f72ce2\",\n                    \"programSpecificOutcomes\": []\n                  }\n                ]\n              },\n              \"courseBranch\": {\n                \"openingSession\": \"2023-2024\",\n                \"branchFullName\": \"Applied Science And Humanities\",\n                \"branchNickName\": \"ASH\",\n                \"branchCode\": \"100\",\n                \"shift\": \"Morning\",\n                \"status\": \"Active\",\n                \"totalIntake\": 500,\n                \"_id\": \"65900f46f0b570dad47ea562\",\n                \"programSpecificOutcomes\": []\n              },\n              \"courseYear\": 1,\n              \"courseSemester\": 2,\n              \"section\": \"E\",\n              \"group\": \"ALL\",\n              \"subject\": {\n                \"_id\": \"67eb9436e7a8b14b22875d8b\",\n                \"subjectCode\": \"BAS205\",\n                \"subjectName\": \"Soft Skill\"\n              },\n              \"subjectType\": \"Regular\",\n              \"timetable\": \"09:10-10:05\",\n              \"lectureType\": \"Lecture\",\n              \"unitHours\": 1,\n              \"month\": 3,\n              \"weekNo\": 1,\n              \"yearlyWeekNo\": 14,\n              \"weekDay\": 1,\n              \"date\": \"2026-03-30T13:59:59.000Z\",\n              \"dateday\": 30,\n              \"isChanged\": false,\n              \"attendanceMarked\": true,\n              \"lectureAttended\": true,\n              \"user\": {\n                \"_id\": \"66c8333a12a3895cab4dc154\",\n                \"nickName\": \"Mrs. Shelly\",\n                \"fullName\": \"Shelly \"\n              },\n              \"currentUser\": {\n                \"_id\": \"66c8333a12a3895cab4dc154\",\n                \"nickName\": \"Mrs. Shelly\",\n                \"fullName\": \"Shelly \"\n              },\n              \"lectureStatus\": \"Active\",\n              \"lectureMode\": \"Class\",\n              \"isViaBiometric\": false,\n              \"facultyInTime\": \"\",\n              \"facultyOutTime\": \"\",\n              \"originalSubject\": \"67eb9436e7a8b14b22875d8b\",\n              \"updated_at\": \"2026-03-30T05:21:05.391Z\",\n              \"created_at\": \"2026-03-29T21:31:01.266Z\",\n              \"__v\": 0,\n              \"attendanceMarkedDate\": \"2026-03-30T13:59:59.000Z\"\n            }\n          ],\n          \"group\": \"ALL\",\n          \"weekDay\": 1,\n          \"slotTime\": \"09:10-10:05\",\n          \"unitHours\": 1\n        },\n        {\n          \"isLunch\": false,\n          \"lunchText\": \"\",\n          \"subjectType\": \"Regular\",\n          \"lectures\": [\n            {\n              \"_id\": \"69c99a155d7f570dcc2661f7\",\n              \"userLecture\": \"69806435272aa35ad80a6dd9\",\n              \"session\": \"2025-2026\",\n              \"sessionYear\": 2026,\n              \"course\": {\n                \"_id\": \"644a12a454180d10c4f7239d\",\n                \"courseNickName\": \"B.Tech\",\n                \"courseFullName\": \"Bachelor of Technology\",\n                \"branch\": [\n                  {\n                    \"openingSession\": \"2022-2023\",\n                    \"branchFullName\": \"Civil Engineering\",\n                    \"branchNickName\": \"CE\",\n                    \"branchCode\": \"00\",\n                    \"shift\": \"Morning\",\n                    \"status\": \"Active\",\n                    \"totalIntake\": 30,\n                    \"_id\": \"644a133c54180d10c4f7244d\",\n                    \"programSpecificOutcomes\": []\n                  },\n                  {\n                    \"openingSession\": \"2022-2023\",\n                    \"branchFullName\": \"Computer Science and Engineering\",\n                    \"branchNickName\": \"CSE\",\n                    \"branchCode\": \"10\",\n                    \"shift\": \"Morning\",\n                    \"status\": \"Active\",\n                    \"totalIntake\": 180,\n                    \"_id\": \"644a1b3254180d10c4f72ce2\",\n                    \"programSpecificOutcomes\": []\n                  }\n                ]\n              },\n              \"courseBranch\": {\n                \"openingSession\": \"2023-2024\",\n                \"branchFullName\": \"Applied Science And Humanities\",\n                \"branchNickName\": \"ASH\",\n                \"branchCode\": \"100\",\n                \"shift\": \"Morning\",\n                \"status\": \"Active\",\n                \"totalIntake\": 500,\n                \"_id\": \"65900f46f0b570dad47ea562\",\n                \"programSpecificOutcomes\": []\n              },\n              \"courseYear\": 1,\n              \"courseSemester\": 2,\n              \"section\": \"E\",\n              \"group\": \"ALL\",\n              \"subject\": {\n                \"_id\": \"67eb9436e7a8b14b22875d88\",\n                \"subjectCode\": \"BAS202\",\n                \"subjectName\": \"Engineering Chemistry\"\n              },\n              \"subjectType\": \"Regular\",\n              \"timetable\": \"10:05-10:55\",\n              \"lectureType\": \"Lecture\",\n              \"unitHours\": 1,\n              \"month\": 3,\n              \"weekNo\": 1,\n              \"yearlyWeekNo\": 14,\n              \"weekDay\": 1,\n              \"date\": \"2026-03-30T13:59:59.000Z\",\n              \"dateday\": 30,\n              \"isChanged\": false,\n              \"attendanceMarked\": true,\n              \"lectureAttended\": true,\n              \"user\": {\n                \"_id\": \"6892ef00d0e34e2479eb8888\",\n                \"nickName\": \"Neeraj Tomar\",\n                \"fullName\": \"Neeraj Tomar\"\n              },\n              \"currentUser\": {\n                \"_id\": \"6892ef00d0e34e2479eb8888\",\n                \"nickName\": \"Neeraj Tomar\",\n                \"fullName\": \"Neeraj Tomar\"\n              },\n              \"lectureStatus\": \"Active\",\n              \"lectureMode\": \"Class\",\n              \"isViaBiometric\": false,\n              \"facultyInTime\": \"\",\n              \"facultyOutTime\": \"\",\n              \"originalSubject\": \"67eb9436e7a8b14b22875d88\",\n              \"updated_at\": \"2026-03-30T11:09:29.644Z\",\n              \"created_at\": \"2026-03-29T21:31:01.275Z\",\n              \"__v\": 0,\n              \"attendanceMarkedDate\": \"2026-03-30T13:59:59.000Z\"\n            }\n          ],\n          \"group\": \"ALL\",\n          \"weekDay\": 1,\n          \"slotTime\": \"10:05-10:55\",\n          \"unitHours\": 1\n        }\n      ]\n    }\n  ],\n  \"abbreviations\": [\n    {\n      \"SN\": 1,\n      \"subject\": {\n        \"_id\": \"67eb9436e7a8b14b22875d8b\",\n        \"subjectCode\": \"BAS205\",\n        \"subjectName\": \"Soft Skill\"\n      },\n      \"faculty\": {\n        \"_id\": \"66c8333a12a3895cab4dc154\",\n        \"nickName\": \"Mrs. Shelly\",\n        \"fullName\": \"Shelly \"\n      }\n    },\n    {\n      \"SN\": 2,\n      \"subject\": {\n        \"_id\": \"67eb9436e7a8b14b22875d88\",\n        \"subjectCode\": \"BAS202\",\n        \"subjectName\": \"Engineering Chemistry\"\n      },\n      \"faculty\": {\n        \"_id\": \"6892ef00d0e34e2479eb8888\",\n        \"nickName\": \"Neeraj Tomar\",\n        \"fullName\": \"Neeraj Tomar\"\n      }\n    }\n  ]\n}", null, 2)}</code></pre>
            </details>
        </div>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/information</span></h3>
            <p class="description">Fetches general administrative college bulletin items and info-board postings.</p>
            <details>
                <summary>View Example Response</summary>
<pre><code>[ { "topic": "Library Rules" } ]</code></pre>
            </details>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/calendar</span></h3>
            <p class="description">Retrieves the official college academic calendar for the holistic year.</p>
            <details>
                <summary>View Example Response</summary>
<pre><code>[ { "event": "Diwali Vacation", "date": "2026-10-20" } ]</code></pre>
            </details>
        </div>

        <!-- App Ecosystem Endpoints -->
        <h2>System Ecosystem</h2>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/app/version</span></h3>
            <p class="description">Allows the native app frontends to safely check if they need a forced downloaded OTA update.</p>
            <div class="headers">
                <p>Returns:</p>
                JSON Payload detailing <code>version</code>, <code>force</code>, <code>message</code>, and <code>downloadUrl</code> from Vercel securely.
            </div>
            <details>
                <summary>View Example Response</summary>
<pre><code>{
  "version": "1.0.1",
  "force": false,
  "message": "Bug fixes and improvements",
  "downloadUrl": "https://your-r2-link/app.apk"
}</code></pre>
            </details>
        </div>

    </div>
</body>
</html>
`;

router.get('/', (req, res) => {
    res.send(htmlContent);
});

module.exports = router;
