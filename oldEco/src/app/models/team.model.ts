export class Team {
  avatar: string = "";
  days: any = {};
  employeeId: string = "";
  employeeName: string = "";

  constructor(
    avatar: string = "",
    days: any = {},
    employeeId: string = "",
    employeeName: string = ""
  ) {
    this.avatar = avatar;
    this.days = days;
    this.employeeId = employeeId;
    this.employeeName = employeeName;
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.avatar = json['avatar'] ?? "";
    this.days = json['days'] ?? {};
    this.employeeId = json['employeeId'] ?? "";
    this.employeeName = json['employeeName'] ?? "";
  }
}
