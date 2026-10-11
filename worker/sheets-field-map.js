// Schema only. Extracted from the approved seven-tab workbook field dictionary. No employee data.
export const SCALAR_MAP={
  "overview": {
    "table": "PeopleCoreRecords",
    "fields": {
      "preferredName": {
        "col": 2,
        "label": "Preferred name",
        "type": "text"
      },
      "employmentStatus": {
        "col": 7,
        "label": "Employment status",
        "type": "select"
      },
      "businessUnit": {
        "col": 12,
        "label": "Business unit / faculty / division",
        "type": "text"
      },
      "employmentType": {
        "col": 8,
        "label": "Employment type",
        "type": "select"
      },
      "dateJoined": {
        "col": 9,
        "label": "Date joined",
        "type": "date"
      },
      "workLocation": {
        "col": 10,
        "label": "Work location",
        "type": "text"
      },
      "workArrangement": {
        "col": 11,
        "label": "Work arrangement",
        "type": "select"
      }
    }
  },
  "personal": {
    "table": "PeopleCoreRecords",
    "fields": {
      "legalName": {
        "col": 34,
        "label": "Full name as per NRIC / passport",
        "type": "text"
      },
      "nric": {
        "col": 35,
        "label": "NRIC number",
        "type": "text"
      },
      "passport": {
        "col": 36,
        "label": "Passport number",
        "type": "text"
      },
      "dateOfBirth": {
        "col": 37,
        "label": "Date of birth",
        "type": "date"
      },
      "gender": {
        "col": 38,
        "label": "Gender",
        "type": "text"
      },
      "nationality": {
        "col": 39,
        "label": "Nationality",
        "type": "text"
      },
      "maritalStatus": {
        "col": 40,
        "label": "Marital status",
        "type": "text"
      },
      "residentialAddress": {
        "col": 41,
        "label": "Residential address",
        "type": "textarea"
      },
      "personalMobile": {
        "col": 42,
        "label": "Personal mobile number",
        "type": "text"
      },
      "personalEmail": {
        "col": 43,
        "label": "Personal email",
        "type": "email"
      },
      "emergencyContact": {
        "col": 44,
        "label": "Emergency contact",
        "type": "text"
      },
      "emergencyRelationship": {
        "col": 45,
        "label": "Emergency contact relationship",
        "type": "text"
      },
      "emergencyNumber": {
        "col": 46,
        "label": "Emergency contact number",
        "type": "text"
      },
      "passportExpiry": {
        "col": 47,
        "label": "Passport expiry",
        "type": "date"
      },
      "visaType": {
        "col": 48,
        "label": "Visa / employment pass type",
        "type": "text"
      },
      "visaExpiry": {
        "col": 49,
        "label": "Visa expiry",
        "type": "date"
      },
      "teachingPermit": {
        "col": 50,
        "label": "Teaching permit number",
        "type": "text"
      },
      "teachingPermitExpiry": {
        "col": 51,
        "label": "Teaching permit expiry",
        "type": "date"
      }
    }
  },
  "employment": {
    "table": "PeopleCoreRecords",
    "fields": {
      "category": {
        "col": 13,
        "label": "Employment category",
        "type": "text"
      },
      "appointmentType": {
        "col": 14,
        "label": "Appointment type",
        "type": "text"
      },
      "grade": {
        "col": 15,
        "label": "Grade / level",
        "type": "text"
      },
      "costCentre": {
        "col": 16,
        "label": "Cost centre",
        "type": "text"
      },
      "secondManager": {
        "col": 17,
        "label": "Second-level manager",
        "type": "text"
      },
      "appointmentDate": {
        "col": 18,
        "label": "Date of appointment",
        "type": "date"
      },
      "confirmationDate": {
        "col": 19,
        "label": "Confirmation date",
        "type": "date"
      },
      "probationStart": {
        "col": 20,
        "label": "Probation start date",
        "type": "date"
      },
      "probationEnd": {
        "col": 21,
        "label": "Probation end date",
        "type": "date"
      },
      "contractStart": {
        "col": 22,
        "label": "Contract start date",
        "type": "date"
      },
      "contractExpiry": {
        "col": 23,
        "label": "Contract expiry date",
        "type": "date"
      },
      "noticePeriod": {
        "col": 24,
        "label": "Notice period",
        "type": "text"
      },
      "workingHours": {
        "col": 25,
        "label": "Working hours",
        "type": "text"
      }
    }
  },
  "compensation": {
    "table": "PeopleCoreRecords",
    "fields": {
      "basicSalary": {
        "col": 79,
        "label": "Basic salary (RM)",
        "type": "number"
      },
      "fixedAllowances": {
        "col": 80,
        "label": "Fixed allowances (RM)",
        "type": "number"
      },
      "variableAllowances": {
        "col": 81,
        "label": "Variable allowances (RM)",
        "type": "number"
      },
      "otherBenefits": {
        "col": 82,
        "label": "Other benefits",
        "type": "textarea"
      },
      "epfStatus": {
        "col": 83,
        "label": "EPF status",
        "type": "text"
      },
      "socsoStatus": {
        "col": 84,
        "label": "SOCSO status",
        "type": "text"
      },
      "eis": {
        "col": 85,
        "label": "EIS",
        "type": "text"
      },
      "tax": {
        "col": 86,
        "label": "PCB / tax information",
        "type": "textarea"
      },
      "bankName": {
        "col": 87,
        "label": "Bank name",
        "type": "text"
      },
      "bankAccount": {
        "col": 88,
        "label": "Bank account information",
        "type": "text"
      },
      "medicalEntitlement": {
        "col": 89,
        "label": "Medical entitlement",
        "type": "textarea"
      },
      "insurance": {
        "col": 90,
        "label": "Insurance coverage",
        "type": "textarea"
      }
    }
  },
  "attendance": {
    "table": "AttendanceSummary",
    "fields": {
      "annualEntitlement": {
        "col": 2,
        "label": "Annual leave entitlement (days)",
        "type": "number"
      },
      "annualTaken": {
        "col": 3,
        "label": "Annual leave taken (days)",
        "type": "number"
      },
      "medicalLeave": {
        "col": 4,
        "label": "Medical leave taken (days)",
        "type": "number"
      },
      "hospitalisationLeave": {
        "col": 5,
        "label": "Hospitalisation leave (days)",
        "type": "number"
      },
      "unpaidLeave": {
        "col": 6,
        "label": "Unpaid leave (days)",
        "type": "number"
      },
      "replacementLeave": {
        "col": 7,
        "label": "Replacement leave (days)",
        "type": "number"
      },
      "period": {
        "col": 8,
        "label": "Attendance period",
        "type": "text"
      },
      "workingDays": {
        "col": 9,
        "label": "Working days",
        "type": "number"
      },
      "daysPresent": {
        "col": 10,
        "label": "Days present",
        "type": "number"
      },
      "lateAttendance": {
        "col": 11,
        "label": "Late attendance occurrences",
        "type": "number"
      },
      "absence": {
        "col": 12,
        "label": "Absence (days)",
        "type": "number"
      },
      "wfhDays": {
        "col": 13,
        "label": "WFH days",
        "type": "number"
      }
    }
  },
  "performance": {
    "table": "CurrentPerformance",
    "fields": {
      "managerComments": {
        "col": 12,
        "label": "Manager comments",
        "type": "textarea"
      },
      "employeeComments": {
        "col": 13,
        "label": "Employee comments",
        "type": "textarea"
      },
      "pipStatus": {
        "col": 14,
        "label": "PIP status",
        "type": "select"
      },
      "pipStart": {
        "col": 15,
        "label": "PIP start date",
        "type": "date"
      },
      "pipEnd": {
        "col": 16,
        "label": "PIP end date",
        "type": "date"
      }
    }
  },
  "learning": {
    "table": "CurrentPerformance",
    "fields": {
      "cpdYear": {
        "col": 19,
        "label": "CPD year",
        "type": "number"
      },
      "developmentPlan": {
        "col": 21,
        "label": "Development plan",
        "type": "textarea"
      },
      "developmentNeeds": {
        "col": 22,
        "label": "Development needs",
        "type": "textarea"
      }
    }
  },
  "qualifications": {
    "table": "CurrentPerformance",
    "fields": {
      "highestQualification": {
        "col": 25,
        "label": "Highest qualification",
        "type": "text"
      },
      "academicDiscipline": {
        "col": 26,
        "label": "Academic discipline",
        "type": "text"
      },
      "teachingSubjects": {
        "col": 27,
        "label": "Teaching subjects",
        "type": "textarea"
      },
      "researchAreas": {
        "col": 28,
        "label": "Research areas",
        "type": "textarea"
      },
      "publications": {
        "col": 29,
        "label": "Publications",
        "type": "textarea"
      },
      "supervision": {
        "col": 30,
        "label": "Postgraduate supervision",
        "type": "textarea"
      },
      "examinerAppointments": {
        "col": 31,
        "label": "External examiner appointments",
        "type": "textarea"
      },
      "memberships": {
        "col": 32,
        "label": "Professional memberships",
        "type": "textarea"
      },
      "researchGrants": {
        "col": 33,
        "label": "Research grants",
        "type": "textarea"
      },
      "orcid": {
        "col": 34,
        "label": "ORCID",
        "type": "text"
      },
      "scopusId": {
        "col": 35,
        "label": "Scopus ID",
        "type": "text"
      },
      "googleScholar": {
        "col": 36,
        "label": "Google Scholar profile",
        "type": "url"
      }
    }
  },
  "talent": {
    "table": "PeopleCoreRecords",
    "fields": {
      "previousPositions": {
        "col": 54,
        "label": "Previous positions",
        "type": "textarea"
      },
      "careerInterests": {
        "col": 55,
        "label": "Career interests",
        "type": "textarea"
      },
      "mobility": {
        "col": 56,
        "label": "Mobility preference",
        "type": "text"
      },
      "promotionReadiness": {
        "col": 57,
        "label": "Promotion readiness",
        "type": "text"
      },
      "successorCandidate": {
        "col": 58,
        "label": "Successor candidate",
        "type": "text"
      },
      "criticalRole": {
        "col": 59,
        "label": "Critical role",
        "type": "select"
      },
      "highPotential": {
        "col": 60,
        "label": "High-potential status",
        "type": "text"
      },
      "retentionRisk": {
        "col": 61,
        "label": "Retention risk",
        "type": "text"
      },
      "aspirations": {
        "col": 62,
        "label": "Career aspirations",
        "type": "textarea"
      }
    }
  },
  "exit": {
    "table": "PeopleCoreRecords",
    "fields": {
      "resignationDate": {
        "col": 65,
        "label": "Resignation date",
        "type": "date"
      },
      "lastWorkingDay": {
        "col": 66,
        "label": "Last working day",
        "type": "date"
      },
      "reason": {
        "col": 67,
        "label": "Reason for leaving",
        "type": "textarea"
      },
      "exitInterview": {
        "col": 68,
        "label": "Exit interview",
        "type": "textarea"
      },
      "clearance": {
        "col": 69,
        "label": "Clearance status",
        "type": "select"
      },
      "assetsReturned": {
        "col": 70,
        "label": "Company assets returned",
        "type": "textarea"
      },
      "finalSalaryStatus": {
        "col": 71,
        "label": "Final salary status",
        "type": "text"
      },
      "leaveEncashment": {
        "col": 72,
        "label": "Leave encashment (RM)",
        "type": "number"
      },
      "outstandingPayments": {
        "col": 73,
        "label": "Outstanding payments (RM)",
        "type": "number"
      },
      "rehireEligibility": {
        "col": 74,
        "label": "Rehire eligibility",
        "type": "select"
      },
      "autoLifecycle": {
        "col": 75,
        "label": "Date-based lifecycle transition",
        "type": "select"
      },
      "alumniApproved": {
        "col": 76,
        "label": "Alumni status approved",
        "type": "select"
      }
    }
  }
};
