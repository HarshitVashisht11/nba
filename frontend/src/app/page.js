"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navigation } from "./components/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Steps } from "./components/steps";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { title: "Subject Details", description: "Enter course information" },
  { title: "Student List", description: "Upload student data" },
  { title: "Exam Details", description: "Enter exam question counts and max marks" },
  { title: "CO Mapping", description: "Map questions to COs" },
  { title: "Marks Entry", description: "Enter assessment marks" },
  { title: "Generate Report", description: "View and download results" },
];

const API_BASE_URL = "http://localhost:5000";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [students, setStudents] = useState([]);
  const [subjectDetails, setSubjectDetails] = useState({
    subject_name: "",
    course_id: "",
    total_co: "",
  });
  // For each exam type, we store a count and an array for question max marks.
  const [examDetails, setExamDetails] = useState({
    minor1: { count: 0, maxMarks: [] },
    minor2: { count: 0, maxMarks: [] },
    final: { count: 0, maxMarks: [] },
  });
  const [coMapping, setCoMapping] = useState([]);
  // marksData structure: { examType: { studentRoll: { "1": mark, "2": mark, ... } } }
  const [marksData, setMarksData] = useState({
    minor1: {},
    minor2: {},
    final: {},
    assignment: {} // added assignment marks storage
  });
  const [reportHtml, setReportHtml] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // --- Step 0: Subject Details ---
  const handleSubjectDetailsSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/submit_subject_details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectDetails),
      });
      setCurrentStep(1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error submitting subject details",
        variant: "destructive",
      });
    }
  };

  // --- Step 1: Student List Upload ---
  const handleStudentFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    // Use field name 'file' per backend expectation.
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/process_excel`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        setStudents(data.students);
        toast({
          title: "Success",
          description: `Loaded ${data.students.length} students`,
        });
        setCurrentStep(2);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error uploading file",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Exam Details ---
  const handleExamDetailsSubmit = (e) => {
    e.preventDefault();
    setCurrentStep(3);
  };

  // When count changes, update the maxMarks array accordingly.
  const handleExamCountChange = (examType, value) => {
    const count = parseInt(value) || 0;
    setExamDetails((prev) => ({
      ...prev,
      [examType]: { count, maxMarks: Array(count).fill("") },
    }));
  };

  // Update max mark for a particular question
  const handleMaxMarkChange = (examType, index, value) => {
    setExamDetails((prev) => {
      const updated = { ...prev[examType] };
      updated.maxMarks[index] = value;
      return { ...prev, [examType]: updated };
    });
  };

  // --- Step 3: CO Mapping ---
  const handleGenerateCoMapping = () => {
    const newMapping = [];
    for (let examType of ["minor1", "minor2", "final"]) {
      for (let q = 1; q <= examDetails[examType].count; q++) {
        newMapping.push({ exam_type: examType, question_number: q, co: "" });
      }
    }
    setCoMapping(newMapping);
  };

  const handleCoMappingSubmit = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/submit_question_mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coMapping),
      });
      setCurrentStep(4);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error saving CO mapping",
        variant: "destructive",
      });
    }
  };

  // --- Step 4: Marks Entry ---
  // We now store marks using keys equal to question numbers (as strings)
  const handleMarksChange = (examType, roll, question, value) => {
    setMarksData((prev) => ({
      ...prev,
      [examType]: {
        ...prev[examType],
        [roll]: {
          ...prev[examType][roll],
          [question]: value || 0,
        },
      },
    }));
  };

  // Helper: Convert marksData for a given exam into CSV string.
  const convertMarksToCSV = (examType) => {
    // For assignment, use a single "marks" field instead of question-wise columns
    if (examType === "assignment") {
      const header = ["roll", "marks"];
      const rows = [header.join(",")];
      students.forEach((student) => {
        const roll = student.roll;
        const mark = marksData.assignment[roll]?.["marks"] || "";
        rows.push([roll, mark].join(","));
      });
      return rows.join("\n");
    } else {
      const exam = examDetails[examType];
      const header = ["roll"];
      for (let i = 1; i <= exam.count; i++) {
        header.push(String(i));
      }
      const rows = [header.join(",")];
      students.forEach((student) => {
        const roll = student.roll;
        const row = [roll];
        for (let i = 1; i <= exam.count; i++) {
          const mark =
            marksData[examType][roll] && marksData[examType][roll][String(i)]
              ? marksData[examType][roll][String(i)]
              : "";
          row.push(mark);
        }
        rows.push(row.join(","));
      });
      return rows.join("\n");
    }
  };

  // Upload marks for a given exam type as a CSV file.
  const uploadMarksForExam = async (examType) => {
    try {
      const csvString = convertMarksToCSV(examType);
      const blob = new Blob([csvString], { type: "text/csv" });
      const file = new File([blob], `${examType}_marks.csv`, {
        type: "text/csv",
      });
      const formData = new FormData();
      formData.append("marks_file", file);
      const res = await fetch(`${API_BASE_URL}/upload_marks/${examType}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${examType.toUpperCase()} marks saved (${data.num_records} records)`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error uploading ${examType} marks`,
        variant: "destructive",
      });
    }
  };

  // Handler for assignment marks change (single input per student)
  const handleAssignmentMarkChange = (roll, value) => {
    setMarksData((prev) => ({
      ...prev,
      assignment: {
        ...prev.assignment,
        [roll]: { marks: value || 0 }
      }
    }));
  };

  // --- Step 5: Generate Report ---
  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      // Call the backend endpoint /generate_mapping
      const res = await fetch(`${API_BASE_URL}/generate_mapping`);
      // Assume the backend sends back an HTML page (plain text) containing the graph.
      const text = await res.text();
      setReportHtml(text);
    } catch (error) {
      // On error, generate a random graph on the client.
      const totalCO = parseInt(subjectDetails.total_co) || 3;
      const randomPoints = Array.from({ length: totalCO }, () =>
        Math.floor(Math.random() * 100)
      );
      const coNames = Array.from({ length: totalCO }, (_, i) => `CO${i + 1}`);
      const randomGraphHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Random Graph</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          </head>
          <body>
            <div id="plot"></div>
            <script>
              var data = [{
                x: ${JSON.stringify(coNames)},
                y: ${JSON.stringify(randomPoints)},
                type: 'bar'
              }];
              var layout = {
                title: 'Random Graph (Error Fallback)',
                xaxis: { title: 'Course Outcomes' },
                yaxis: { title: 'Points' }
              };
              Plotly.newPlot('plot', data, layout);
            </script>
          </body>
        </html>
      `;
      setReportHtml(randomGraphHTML);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Rendering Content by Step ---
  const renderStepContent = () => {
    switch (currentStep) {
      // Step 0: Subject Details
      case 0:
        return (
          <form onSubmit={handleSubjectDetailsSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Subject Name</Label>
              <Input
                type="text"
                value={subjectDetails.subject_name}
                onChange={(e) =>
                  setSubjectDetails((prev) => ({
                    ...prev,
                    subject_name: e.target.value,
                  }))
                }
                placeholder="e.g. Data Structures"
              />
            </div>
            <div className="space-y-4">
              <Label>Course ID</Label>
              <Input
                type="text"
                value={subjectDetails.course_id}
                onChange={(e) =>
                  setSubjectDetails((prev) => ({
                    ...prev,
                    course_id: e.target.value,
                  }))
                }
                placeholder="e.g. CS101"
              />
            </div>
            <div className="space-y-4">
              <Label>Total CO</Label>
              <Input
                type="number"
                min="1"
                value={subjectDetails.total_co}
                onChange={(e) =>
                  setSubjectDetails((prev) => ({
                    ...prev,
                    total_co: e.target.value,
                  }))
                }
                placeholder="e.g. 5"
              />
            </div>
            <Button type="submit">Next</Button>
          </form>
        );

      // Step 1: Student List Upload
      case 1:
        return (
          <div className="space-y-4">
            <input
              type="file"
              onChange={handleStudentFileUpload}
              accept=".csv,.xlsx,.xls"
            />
            {students.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Student Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{student.roll}</TableCell>
                      <TableCell>{student.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );

      // Step 2: Exam Details (Enter question count and max marks per question)
      case 2:
        return (
          <form onSubmit={handleExamDetailsSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {["minor1", "minor2", "final"].map((examType) => (
                <div key={examType} className="space-y-2 border p-2 rounded">
                  <Label>{examType.toUpperCase()} Questions</Label>
                  <Input
                    type="number"
                    min="0"
                    value={examDetails[examType].count}
                    onChange={(e) => handleExamCountChange(examType, e.target.value)}
                    placeholder="Number of questions"
                  />
                  {examDetails[examType].count > 0 && (
                    <div className="space-y-1 mt-2">
                      {Array.from({ length: examDetails[examType].count }, (_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Label className="whitespace-nowrap">
                            Q{i + 1} Max Marks:
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={examDetails[examType].maxMarks[i] || ""}
                            onChange={(e) => handleMaxMarkChange(examType, i, e.target.value)}
                            placeholder="e.g. 10"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button type="submit">Next</Button>
          </form>
        );

      // Step 3: CO Mapping
      case 3:
        return (
          <div className="space-y-6">
            <Button onClick={handleGenerateCoMapping}>
              Generate CO Mapping Fields
            </Button>
            {coMapping.length > 0 && (
              <div className="space-y-4">
                {coMapping.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span>
                      {item.exam_type.toUpperCase()} Q{item.question_number}
                    </span>
                    <Select
                      value={item.co}
                      onValueChange={(value) =>
                        setCoMapping((prev) =>
                          prev.map((m, i) => (i === index ? { ...m, co: value } : m))
                        )
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="CO" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: subjectDetails.total_co }, (_, i) => (
                          <SelectItem key={i + 1} value={`CO${i + 1}`}>
                            CO{i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button onClick={handleCoMappingSubmit}>Save Mapping</Button>
              </div>
            )}
          </div>
        );

      // Step 4: Marks Entry (one table per exam type)
      case 4:
        return (
          <div className="space-y-8">
            {["minor1", "minor2", "final"].map((examType) => (
              <div key={examType} className="space-y-4">
                <h3 className="text-lg font-semibold">
                  {examType.toUpperCase()} Marks
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      {Array.from({ length: examDetails[examType].count }, (_, i) => (
                        <TableHead key={i}>{i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.roll}>
                        <TableCell>{student.name}</TableCell>
                        {Array.from({ length: examDetails[examType].count }, (_, i) => (
                          <TableCell key={i}>
                            <Input
                              type="number"
                              min="0"
                              value={
                                marksData[examType][student.roll]?.[String(i + 1)] ||
                                ""
                              }
                              onChange={(e) =>
                                handleMarksChange(
                                  examType,
                                  student.roll,
                                  String(i + 1),
                                  e.target.value
                                )
                              }
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={() => uploadMarksForExam(examType)}>
                  Save {examType.toUpperCase()} Marks
                </Button>
              </div>
            ))}

            {/* New Section: Assignment Marks */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Assignment Marks</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.roll}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={
                            marksData.assignment[student.roll]?.["marks"] || ""
                          }
                          onChange={(e) =>
                            handleAssignmentMarkChange(
                              student.roll,
                              e.target.value
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={() => uploadMarksForExam("assignment")}>
                Save ASSIGNMENT Marks
              </Button>
            </div>
          </div>
        );

      // Step 5: Generate Report
      case 5:
        return (
          <div className="space-y-4 text-center">
            <p>
              Click the button below to generate the CO–PO mapping report.
            </p>
            <Button onClick={handleGenerateReport} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>
            {reportHtml && (
              <iframe
                title="CO-PO Mapping Report"
                srcDoc={reportHtml}
                style={{ width: "100%", height: "600px", border: "none" }}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">CO-PO Mapping Generator</h1>
          <p className="text-muted-foreground">
            Generate your CO-PO mapping with ease
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              Track your progress through the mapping generation process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Steps steps={steps} currentStep={currentStep} />
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>
              {steps[currentStep].description}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() =>
              setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))
            }
            disabled={currentStep === steps.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </main>
  );
}
