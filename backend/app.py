from flask import Flask, request, jsonify, render_template, session
import pandas as pd
import os
import plotly.express as px
import cors
import io

# Initialize the Flask app
app = Flask(__name__)

# Enable CORS
cors.CORS(app)

#########################################
# Helper Functions
#########################################
def detect_student_columns(df):
    """
    Look for columns with keywords that suggest student name and roll number.
    """
    headers = [col.strip().lower() for col in df.columns]
    name_col = None
    roll_col = None
    for i, header in enumerate(headers):
        if any(keyword in header for keyword in ['name', 'student']):
            name_col = df.columns[i]
        if any(keyword in header for keyword in ['roll', 'id']):
            roll_col = df.columns[i]
    return name_col, roll_col

def parse_marks_file(file):
    """
    Read CSV or Excel file using pandas.
    """
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
    else:
        df = pd.read_excel(file)
    return df

#########################################
# Routes
#########################################

# 1. Upload Student List
@app.route('/upload_students', methods=['POST'])
def upload_students():
    file = request.files.get('student_file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400
    try:
        df = parse_marks_file(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    name_col, roll_col = detect_student_columns(df)
    if not name_col or not roll_col:
        return jsonify({'error': 'Could not detect student name and roll number columns'}), 400
    # Create list of student dictionaries
    students = df[[name_col, roll_col]].to_dict(orient='records')
    session['students'] = students
    return jsonify({'students_preview': students[:5], 'total_students': len(students)})

# 2. Submit Subject Details
@app.route('/submit_subject_details', methods=['POST'])
def submit_subject_details():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    subject_details = {
        'subject_name': data.get('subject_name'),
        'course_id': data.get('course_id'),
        'total_co': data.get('total_co')
    }
    session['subject_details'] = subject_details
    return jsonify({'status': 'Subject details saved'})

# 3. Submit Question-wise CO Mapping
@app.route('/submit_question_mapping', methods=['POST'])
def submit_question_mapping():
    mapping_data = request.get_json()  # Expect a list of dicts.
    if not mapping_data:
        return jsonify({'error': 'No mapping data provided'}), 400
    # Each mapping entry should have exam_type, question_number, and co.
    session['question_mapping'] = mapping_data
    return jsonify({'status': 'Question mapping saved'})

# 4. Upload Marks for a Given Exam Type
# Exam types: 'minor1', 'minor2', 'assignment', 'final'
@app.route('/upload_marks/<exam_type>', methods=['POST'])
def upload_marks(exam_type):
    file = request.files.get('marks_file')
    if not file:
        return jsonify({'error': 'No marks file uploaded'}), 400
    try:
        df = parse_marks_file(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    # Convert dataframe to dictionary records
    marks = df.to_dict(orient='records')
    marks_data = session.get('marks_data', {})
    marks_data[exam_type] = marks
    session['marks_data'] = marks_data
    return jsonify({'status': f'Marks for {exam_type} saved', 'num_records': len(marks)})

# 5. Generate CO Mapping Report and Graph
@app.route('/generate_mapping', methods=['GET'])
def generate_mapping():
    # Retrieve stored data from session
    students = session.get('students', [])
    subject_details = session.get('subject_details', {})
    question_mapping = session.get('question_mapping', [])
    marks_data = session.get('marks_data', {})

    if not (students and subject_details and question_mapping and marks_data):
        return jsonify({'error': 'Missing one or more required inputs'}), 400

    # Create a dictionary to collect scores per CO for each exam type.
    # Structure: { exam_type: {co: [list of scores across all questions mapped to this CO]} }
    exam_scores = {'minor1': {}, 'minor2': {}, 'assignment': {}, 'final': {}}
    
    # Loop through each mapping entry.
    for mapping in question_mapping:
        exam_type = mapping.get('exam_type').lower()  # e.g. "minor1"
        q_num = mapping.get('question_number')
        co = mapping.get('co')  # Assume this is a string like "CO1"
        # Ensure exam_type is one we expect
        if exam_type not in exam_scores:
            continue
        # Get marks data for this exam type
        exam_marks = marks_data.get(exam_type, [])
        # For each record (student) in this exam, try to extract the marks for the question.
        for record in exam_marks:
            # Assume the key for question is exactly the q_num (as string)
            # If the column does not exist, default to 0.
            try:
                score = float(record.get(str(q_num), 0))
            except:
                score = 0
            exam_scores[exam_type].setdefault(co, []).append(score)
    
    # For each CO, compute the average score per exam type
    co_avg = {}
    exam_types = ['minor1', 'minor2', 'assignment', 'final']
    for exam in exam_types:
        for co, scores in exam_scores[exam].items():
            avg_score = sum(scores) / len(scores) if scores else 0
            co_avg.setdefault(co, {})[exam] = avg_score

    # Now, apply the rule for minor: if both minor1 and minor2 exist for a CO, choose the higher average.
    co_final = {}
    # Define weightages:
    weight_minor = 0.30
    weight_assignment = 0.20
    weight_final = 0.50

    for co, exam_avgs in co_avg.items():
        # For minor, check if both exist
        minor_score = 0
        if 'minor1' in exam_avgs and 'minor2' in exam_avgs:
            minor_score = max(exam_avgs.get('minor1', 0), exam_avgs.get('minor2', 0))
        elif 'minor1' in exam_avgs:
            minor_score = exam_avgs.get('minor1', 0)
        elif 'minor2' in exam_avgs:
            minor_score = exam_avgs.get('minor2', 0)
        assignment_score = exam_avgs.get('assignment', 0)
        final_score = exam_avgs.get('final', 0)
        # Compute overall weighted CO score
        overall = (minor_score * weight_minor) + (assignment_score * weight_assignment) + (final_score * weight_final)
        co_final[co] = overall

    # Generate a bar graph using Plotly
    co_names = list(co_final.keys())
    co_scores_list = list(co_final.values())
    fig = px.bar(x=co_names, y=co_scores_list,
                 labels={'x': 'Course Outcomes', 'y': 'Weighted Attainment Score'},
                 title=f"CO Attainment for {subject_details.get('subject_name', 'Subject')}")
    graph_html = fig.to_html(full_html=False)

    # Render a simple results page (make sure you have a results.html template in your templates folder)
    return render_template('results.html',
                           subject=subject_details,
                           co_attainment=co_final,
                           graph_html=graph_html)

#########################################
# Run the App
#########################################
if __name__ == '__main__':
    app.run(debug=True)
