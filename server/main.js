// server.js
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Setup multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// In-memory storage for data
const appData = {
  students: [],
  subject_details: null,
  question_mapping: [],
  marks_data: {}
};

// ----------------------------
// Helper Functions
// ----------------------------
function parseFile(buffer, filename) {
  // Reads an Excel or CSV file from a buffer.
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  return data;
}

function detectStudentColumns(data) {
  // Expects data as an array of objects.
  // Detects a column with keywords "name" or "student" and one with "roll" or "id".
  let nameCol = null;
  let rollCol = null;
  if (!data.length) return { nameCol, rollCol };
  const headers = Object.keys(data[0]).map((col) => col.trim().toLowerCase());
  const originalHeaders = Object.keys(data[0]);
  headers.forEach((header, index) => {
    if (!nameCol && header.includes('name')) {
      nameCol = originalHeaders[index];
    }
    if (!rollCol && (header.includes('roll') || header.includes('id'))) {
      rollCol = originalHeaders[index];
    }
  });
  return { nameCol, rollCol };
}

// ----------------------------
// Routes
// ----------------------------

// 1. Process Excel (or CSV) Sheet to extract student list
app.post('/process_excel', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  try {
    const data = parseFile(req.file.buffer, req.file.originalname);
    const { nameCol, rollCol } = detectStudentColumns(data);
    if (!nameCol || !rollCol) {
      return res
        .status(400)
        .json({ error: 'Could not detect student name and roll number columns' });
    }
    const students = data.map((row) => ({
      roll: String(row[rollCol]).trim(),
      name: String(row[nameCol]).trim(),
    }));
    appData.students = students;
    res.json({
      students,
      total_students: students.length,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Submit Subject Details
app.post('/submit_subject_details', (req, res) => {
  const data = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }
  appData.subject_details = {
    subject_name: data.subject_name,
    course_id: data.course_id,
    total_co: data.total_co,
  };
  res.json({ status: 'Subject details saved' });
});

// 3. Submit Question-wise CO Mapping
// Expects an array of objects with keys: exam_type, question_number, co.
app.post('/submit_question_mapping', (req, res) => {
  const mapping_data = req.body;
  if (!mapping_data) {
    return res.status(400).json({ error: 'No mapping data provided' });
  }
  appData.question_mapping = mapping_data;
  res.json({ status: 'Question mapping saved' });
});

// 4. Upload Marks for a Given Exam Type
// Expected exam types: 'minor1', 'minor2', 'assignment', 'final'
app.post('/upload_marks/:exam_type', upload.any(), (req, res) => {
  const exam_type = req.params.exam_type;
  // Extract the file with fieldname "marks_file"
  const file = req.files.find((f) => f.fieldname === "marks_file");
  if (!file) {
    return res.status(400).json({ error: 'No marks file uploaded with fieldname "marks_file"' });
  }
  try {
    const data = parseFile(file.buffer, file.originalname);
    appData.marks_data[exam_type] = data;
    res.json({ status: `Marks for ${exam_type} saved`, num_records: data.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Generate CO-PO Mapping Report and Graph
app.get('/generate_mapping', (req, res) => {
  const { students, subject_details, question_mapping, marks_data } = appData;

  if (
    !students.length ||
    !subject_details ||
    !question_mapping.length ||
    !Object.keys(marks_data).length
  ) {
    return res
      .status(400)
      .json({ error: 'Missing one or more required inputs' });
  }

  // ---------------------------
  // Parameters & Assumptions
  // ---------------------------
  const max_marks_per_question = 10; // Assumed maximum mark per question
  const total_co = parseInt(subject_details.total_co) || 1;
  const exam_types = ['minor1', 'minor2', 'final'];

  // ---------------------------
  // 1. For each exam (minor1, minor2, final):
  //    - Group mapping entries by CO and count number of questions.
  //    - Compute target marks = (number_of_questions * max_marks_per_question) / 2.
  //    - Sum each student's marks (from marks_data) for questions mapped to that CO.
  // ---------------------------
  let co_data = {}; // { exam_type: { co: { target, scores: [score, ...] } } }
  exam_types.forEach((exam) => {
    co_data[exam] = {};
    // Filter mapping entries for this exam type (case-insensitive)
    const mappings = question_mapping.filter(
      (m) => (m.exam_type || '').toLowerCase() === exam
    );
    // Group question numbers by CO.
    let co_questions = {};
    mappings.forEach((m) => {
      const co = m.co;
      if (!co) return;
      const qnum = String(m.question_number);
      if (!co_questions[co]) {
        co_questions[co] = [];
      }
      co_questions[co].push(qnum);
    });
    // For each CO, compute target marks and student scores.
    for (const co in co_questions) {
      const q_list = co_questions[co];
      const max_marks = q_list.length * max_marks_per_question;
      const target = max_marks / 2.0;
      let student_scores = [];
      const exam_marks = marks_data[exam] || [];
      exam_marks.forEach((record) => {
        let total = 0;
        q_list.forEach((q) => {
          let val = parseFloat(record[q] || 0);
          if (isNaN(val)) val = 0;
          total += val;
        });
        student_scores.push(total);
      });
      co_data[exam][co] = { target, scores: student_scores };
    }
  });

  // ---------------------------
  // 2. Process Assignment separately.
  // For assignment, assume each student record has a key "marks".
  // Each student's per-CO assignment score = (marks / total_co) and target = half of the maximum per CO.
  // ---------------------------
  let assignment_data = {};
  if (marks_data.assignment) {
    let student_assignment_scores = [];
    marks_data.assignment.forEach((record) => {
      let m = parseFloat(record['marks'] || 0);
      if (isNaN(m)) m = 0;
      let per_co = m / total_co;
      student_assignment_scores.push(per_co);
    });
    const max_assignment_per_co =
      student_assignment_scores.length > 0
        ? Math.max(...student_assignment_scores)
        : 0;
    const target_assignment = max_assignment_per_co / 2.0;
    assignment_data = { target: target_assignment, scores: student_assignment_scores };
  }

  // ---------------------------
  // 3. For each exam type (and assignment), calculate percentage of students scoring at or above the target,
  //    then assign points:
  //      - ≥ 70%  → 3 points
  //      - ≥ 60%  → 2 points
  //      - ≥ 50%  → 1 point
  //      - Otherwise → 0 points
  // ---------------------------
  function pointsFromPercentage(pct) {
    if (pct >= 70) return 3;
    else if (pct >= 60) return 2;
    else if (pct >= 50) return 1;
    else return 0;
  }

  let exam_points = {}; // { exam_type: { co: points } }
  exam_types.forEach((exam) => {
    exam_points[exam] = {};
    for (const co in co_data[exam]) {
      const { target, scores } = co_data[exam][co];
      let pct = 0;
      if (scores.length) {
        const count = scores.filter((s) => s >= target).length;
        pct = (count / scores.length) * 100;
      }
      exam_points[exam][co] = pointsFromPercentage(pct);
    }
  });

  // For assignment, assign the same points to each CO.
  let assignment_points = {};
  if (assignment_data && assignment_data.scores) {
    const { target, scores } = assignment_data;
    let pct = 0;
    if (scores.length) {
      const count = scores.filter((s) => s >= target).length;
      pct = (count / scores.length) * 100;
    }
    for (let i = 1; i <= total_co; i++) {
      assignment_points[`CO${i}`] = pointsFromPercentage(pct);
    }
  }

  // ---------------------------
  // 4. Overall CO Points Calculation:
  //    For each CO, overall points = 0.3 * (max(minor1, minor2) points) + 0.5 * (final points) + 0.2 * (assignment points)
  // ---------------------------
  let overall_co_points = {};
  for (let i = 1; i <= total_co; i++) {
    const co_key = `CO${i}`;
    let minor_points = 0;
    if (exam_points.minor1[co_key] !== undefined) {
      minor_points = exam_points.minor1[co_key];
    }
    if (exam_points.minor2[co_key] !== undefined) {
      minor_points = Math.max(minor_points, exam_points.minor2[co_key]);
    }
    const final_points = exam_points.final[co_key] || 0;
    const assign_points = assignment_points[co_key] || 0;
    const overall = 0.3 * minor_points + 0.5 * final_points + 0.2 * assign_points;
    overall_co_points[co_key] = overall;
  }

  // ---------------------------
  // 5. Generate a Bar Graph using Plotly (as an HTML string)
  // ---------------------------
  const co_names = Object.keys(overall_co_points);
  const co_scores_list = Object.values(overall_co_points);
  const subjectName = subject_details.subject_name || 'Subject';
  const graphHTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>CO Attainment</title>
      <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    </head>
    <body>
      <div id="plot"></div>
      <script>
        var data = [{
          x: ${JSON.stringify(co_names)},
          y: ${JSON.stringify(co_scores_list)},
          type: 'bar'
        }];
        var layout = {
          title: 'CO Attainment for ${subjectName}',
          xaxis: { title: 'Course Outcomes' },
          yaxis: { title: 'Overall Points' }
        };
        Plotly.newPlot('plot', data, layout);
      </script>
    </body>
  </html>
  `;

  // Force no caching to ensure graph is generated each request
  res.set('Cache-Control', 'no-store');
  res.send(graphHTML);
});

// ----------------------------
// Run the App
// ----------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
