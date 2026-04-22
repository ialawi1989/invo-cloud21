import { ApiLimiterRepo } from "@src/apiLimiter";
import { EmployeeController } from "@src/controller/admin/employee.controller";
import { EmployeePrivilegesController } from "@src/controller/admin/employeePrivilege.controller";
import { EmployeeScheduleController } from "@src/controller/admin/employeeSchedule.controller";
import { AttendanceController } from "@src/controller/app/Settings/attendance.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";

const router = createAsyncRouter();
router.post('/saveEmployee',EmployeeController.saveEmployee)
router.post('/setEmployeeDashboard',EmployeeController.setEmployeeDashboard)
router.get('/getEmployeeDashboard',EmployeeController.getEmployeeDashboard)

router.post('/setEmployeeOptions',EmployeeController.setEmployeeOptions)
router.get('/getEmployeeOptions',EmployeeController.getEmployeeOptions)
router.post('/getEmployeeList2',EmployeeController.getEmployeeList)
router.get('/getEmployee/:employeeId',EmployeeController.getEmployee)
router.post('/setNewPassword', EmployeeController.setNewPassword)


router.post('/getEmployeePrivilegeList',EmployeePrivilegesController.getEmployeePrivilageList)
router.get('/getEmployeePrivilege/:employeePrivilegeid',EmployeePrivilegesController.getEmployeePrivilageById)
router.post('/saveEmployeePrivilege',EmployeePrivilegesController.savePrivileges)


router.post('/saveEmployeeSchedule',EmployeeScheduleController.saveEmployeeSchedule)
router.post('/getEmployeesSchedule',EmployeeScheduleController.getEmployeesSchedule)

router.post('/saveEmployeeOffDay',EmployeeScheduleController.saveEmployeeOffDay)
router.get('/getEmployeeOffDay/:offDayId',EmployeeScheduleController.getEmployeeOffDay)
router.get('/deleteEmployeeOffDay/:offDayId',EmployeeScheduleController.deleteEmployeeOffDays)


router.post('/saveShiftExceptions',EmployeeScheduleController.saveShiftExceptions)
router.post('/saveAdditionalShifts',EmployeeScheduleController.saveAdditionalShifts)

router.get('/getCompanyEmployee/:companyId/:employeeId', EmployeeController.getCompanyEmployee)
router.post('/getCompanyGroupEmployees', EmployeeController.getCompanyGroupEmployees)


router.get('/sendEmployeeInvention/employeeId', EmployeeController.sendEmployeeInvention)






// employee routes////////////
router.post('/getEmployeeByEmail',EmployeeController.getEmployeeByEmail);
router.post('/saveInvitedEmployee', EmployeeController.saveCompanyEmployee)
router.get('/getCompanyList', EmployeeController.getCompanyList)
router.post('/getEmployeeList',EmployeeController.GetAllCompanyEmployee);



router.get('/getEmployee/:employeeId/:companyId',EmployeeController.GetEmployeeByID);

router.post('/addEmployee',EmployeeController.AddNewEmployee)
router.post('/updateEmployee',EmployeeController.EditEmployeeInfo)

//attendance 

router.post('/adjustEmployeeAttendance',AttendanceController.adjustClockedInAndOut)
router.get('/getAttendance/:id',AttendanceController.getAttendanceById)
router.post('/getAttendanceList',AttendanceController.getAttendanceList)



export default router;