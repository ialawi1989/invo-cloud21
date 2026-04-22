export class ScheduledReport {
  id: string | null = null;

  companyId: string  = "";
  employeeId: string  = "";
  reportType: string = "";
  attachmentType: "pdf" | "xlsx" = "pdf"; // default to PDF

  startDate: string =  ""
  scheduleTime: string = "00:00"; // Default time, HH:mm format
  frequency: "daily" | "weekly" | "monthly" | "yearly" = "daily";

  recipients = []
  additionalRecipients =[]

  nextRun: Date | null = null;
  previousRun: Date | null = null;

  isActive: boolean = true;
  filter = {}

  /**
   * Parse and assign values from a plain JSON object
   */
  ParseJson(json: any): void {
    for (const key in json) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        (this as any)[key] = json[key];
      }
    }
  }
}








