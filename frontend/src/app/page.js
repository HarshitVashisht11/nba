"use client";

import { useState, useRef } from "react";
import { Navigation } from "./components/navigation";
import { Steps } from "./components/steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const steps = [
  {
    title: "Student List",
    description: "Upload student data",
  },
  {
    title: "Subject Details",
    description: "Enter course information",
  },
  {
    title: "CO Mapping",
    description: "Map questions to COs",
  },
  {
    title: "Marks Upload",
    description: "Upload assessment marks",
  },
  {
    title: "Generate Report",
    description: "View and download results",
  },
];

const API_BASE_URL = 'http://localhost:5000';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [subjectDetails, setSubjectDetails] = useState({
    subject_name: "",
    course_id: "",
    total_co: "",
  });
  const [mappingData, setMappingData] = useState([]);
  const [marksFiles, setMarksFiles] = useState({
    minor1: null,
    minor2: null,
    assignment: null,
    final: null,
  });
  const [reportHtml, setReportHtml] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // References for file inputs
  const studentFileRef = useRef(null);
  const minor1FileRef = useRef(null);
  const minor2FileRef = useRef(null);
  const assignmentFileRef = useRef(null);
  const finalFileRef = useRef(null);

  // Step 1: Student List Upload
  const handleStudentFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("student_file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload_students`, {
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
        setUploadPreview(data.students_preview);
        toast({
          title: "Success",
          description: "File uploaded successfully",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Error uploading file",
        variant: "destructive",
      });
    }
  };

  // Step 2: Subject Details Submission
  const handleSubjectDetailsSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/submit_subject_details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectDetails),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Subject details saved!");
      }
    } catch (error) {
      console.error(error);
      alert("Error submitting subject details");
    }
  };

  // Step 3: CO Mapping Submission
  // For simplicity, we assume a JSON textarea input for mapping
  const handleMappingSubmit = async () => {
    // mappingData is expected to be an array of objects, e.g.:
    // [{ exam_type: "minor1", question_number: "Q1", co: "CO1" }, ...]
    try {
      const res = await fetch("/submit_question_mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingData),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Mapping data saved!");
      }
    } catch (error) {
      console.error(error);
      alert("Error submitting mapping data");
    }
  };

  // Step 4: Marks Upload for each exam type
  const handleMarksUpload = async (examType, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("marks_file", file);
    try {
      const res = await fetch(`/upload_marks/${examType}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Marks for ${examType} saved (${data.num_records} records)`);
      }
    } catch (error) {
      console.error(error);
      alert(`Error uploading marks for ${examType}`);
    }
  };

  // Step 5: Generate Report
  const handleGenerateReport = async () => {
    try {
      const res = await fetch("/generate_mapping");
      const text = await res.text();
      // Assume the endpoint returns rendered HTML (or you can parse JSON)
      setReportHtml(text);
    } catch (error) {
      console.error(error);
      alert("Error generating report");
    }
  };

  // Render different content for each step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">File Upload</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="student-file"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-8 h-8 mb-4 text-muted-foreground"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV or Excel files
                      </p>
                    </div>
                    <input
                      id="student-file"
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx,.xls"
                      ref={studentFileRef}
                      onChange={handleStudentFileUpload}
                    />
                  </label>
                </div>
              </TabsContent>
              <TabsContent value="preview" className="py-8">
                {uploadPreview ? (
                  <div>
                    <h3 className="font-semibold">Preview:</h3>
                    <ul>
                      {uploadPreview.map((student, idx) => (
                        <li key={idx}>
                          {student["Name"] || student["name"]} -{" "}
                          {student["Roll"] || student["roll"] || student["ID"] || student["id"]}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    Upload a file to see the preview
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        );
      case 1:
        return (
          <form onSubmit={handleSubjectDetailsSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject_name">Subject Name</Label>
                <Input
                  id="subject_name"
                  placeholder="Enter subject name"
                  value={subjectDetails.subject_name}
                  onChange={(e) =>
                    setSubjectDetails({
                      ...subjectDetails,
                      subject_name: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_id">Course ID</Label>
                <Input
                  id="course_id"
                  placeholder="Enter course ID"
                  value={subjectDetails.course_id}
                  onChange={(e) =>
                    setSubjectDetails({
                      ...subjectDetails,
                      course_id: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full">Submit Details</Button>
          </form>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p>
              Enter your CO Mapping in JSON format
            </p>
            <textarea
              className="textarea w-full"
              rows="6"
              placeholder='[{"exam_type": "minor1", "question_number": "Q1", "co": "CO1"}, {"exam_type": "final", "question_number": "Q2", "co": "CO2"}]'
              onChange={(e) => {
                try {
                  setMappingData(JSON.parse(e.target.value));
                } catch (error) {
                  console.error("Invalid JSON");
                }
              }}
            ></textarea>
            <Button onClick={handleMappingSubmit}>Submit Mapping Data</Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Minor 1 Marks</h3>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={minor1FileRef}
                  onChange={(e) =>
                    setMarksFiles({ ...marksFiles, minor1: e.target.files[0] })
                  }
                />
                <Button 
                  onClick={() => handleMarksUpload("minor1", minor1FileRef.current.files[0])}
                  variant="secondary"
                >
                  Upload
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Minor 2 Marks</h3>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={minor2FileRef}
                  onChange={(e) =>
                    setMarksFiles({ ...marksFiles, minor2: e.target.files[0] })
                  }
                />
                <Button 
                  onClick={() => handleMarksUpload("minor2", minor2FileRef.current.files[0])}
                  variant="secondary"
                >
                  Upload
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Assignment Marks</h3>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={assignmentFileRef}
                  onChange={(e) =>
                    setMarksFiles({ ...marksFiles, assignment: e.target.files[0] })
                  }
                />
                <Button 
                  onClick={() => handleMarksUpload("assignment", assignmentFileRef.current.files[0])}
                  variant="secondary"
                >
                  Upload
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Final Exam Marks</h3>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={finalFileRef}
                  onChange={(e) =>
                    setMarksFiles({ ...marksFiles, final: e.target.files[0] })
                  }
                />
                <Button 
                  onClick={() => handleMarksUpload("final", finalFileRef.current.files[0])}
                  variant="secondary"
                >
                  Upload
                </Button>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 text-center">
            <p>
              Click the button below to generate the CO–PO mapping report.
            </p>
            <Button 
              onClick={handleGenerateReport} 
              disabled={isLoading}
            >
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
              <div className="mt-8" dangerouslySetInnerHTML={{ __html: reportHtml }} />
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
            onClick={() =>
              setCurrentStep((prev) => Math.max(0, prev - 1))
            }
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() =>
              setCurrentStep((prev) =>
                Math.min(steps.length - 1, prev + 1)
              )
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
