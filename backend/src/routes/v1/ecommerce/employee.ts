import { EmployeeController } from "@src/controller/admin/employee.controller";
import { EmployeePrivilegesController } from "@src/controller/admin/employeePrivilege.controller";
import { EmployeeScheduleController } from "@src/controller/admin/employeeSchedule.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";

const router = createAsyncRouter();



router.post('/getEmployeesSchedule',EmployeeScheduleController.getEmployeesSchedule)
router.post('/getEmployeesScheduleForAppointment',EmployeeScheduleController.getEmployeesScheduleForAppointment)

export default router;