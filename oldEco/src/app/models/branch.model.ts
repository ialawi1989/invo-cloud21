export class Branch {
  name: string = "";
  id: string = "";
  address: string = "";
  location: { [key: string]: any } = {};
  phoneNumber: string = "";
  onlineAvailability: boolean = true;
  workingSchedule: { [key: string]: any } = {};
  deliveryTimes: { [key: string]: any } = {};
  workingHours: string = "";
  currentStatus: string = "";

  isCovered: boolean = false;
  distanceFromLocation: any;

  getTodayName = () => {
    const currentTime = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[currentTime.getDay()];
  };
  formatTime = (time24: any) => {
    if (!time24) return '';

    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minutes} ${ampm}`;
  };
  getTodayHours = () => {
    const today = this.getTodayName();
    const todaySchedule = this.workingSchedule[today];

    if (!todaySchedule || todaySchedule.length === 0) {
      return 'Closed today';
    }

    // Handle multiple time slots
    return todaySchedule.map((slot: any) => {
      if (slot.from === "00:00" && slot.to === "23:59") {
        return "24 Hours";
      }
      return `${this.formatTime(slot.from)} - ${this.formatTime(slot.to)}`;
    }).join(', ');
  };

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        // Handle nested objects (keep object type if expected)
        if (typeof this[key as keyof this] === "object" && this[key as keyof this] !== null) {
          this[key as keyof this] = { ...json[key] };
        } else {
          this[key as keyof this] = json[key];
        }
      }
    }
    if (this.currentStatus === 'close') {
      this.currentStatus = 'closed';
    }
  }
}
