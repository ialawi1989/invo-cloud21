
export class EmployeePrivileg {
    id = "";
    name = "";
    privileges = new Privilege();
    companyId = "";
    updatedDate = new Date();
    createdAt = new Date();


    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "privileges") {
                let privilege = new Privilege()
                privilege.ParseJson(json[key])
                this[key] = privilege;

            } else {
                this[key as keyof typeof this] = json[key];
            }
        }
    }


    Waiter() {

        let witerPrivileges = new Privilege();
        for (const key in witerPrivileges) {
            const keyName: keyof Privilege = key as keyof Privilege;
            const nestedObject: any = witerPrivileges[keyName];
            nestedObject.access = false
            if ("actions" in nestedObject) {
                const actions = nestedObject.actions;
                for (const actionKey in actions) {
                    if (actionKey in actions) {
                        actions[actionKey].access = false;
                    }
                    nestedObject.actions = actions;
                }
            }
            witerPrivileges[keyName] = nestedObject;

        }

        this.privileges = witerPrivileges


        /**Invoice Security Actions */
        if (witerPrivileges.invoiceSecurity.actions) {
            if (witerPrivileges.invoiceSecurity.actions.add) {
                witerPrivileges.invoiceSecurity.actions.add.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.edit) {
                witerPrivileges.invoiceSecurity.actions.edit.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.print) {
                witerPrivileges.invoiceSecurity.actions.print.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.view) {
                witerPrivileges.invoiceSecurity.actions.view.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.expandedTicket) {
                witerPrivileges.invoiceSecurity.actions.expandedTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.pendingOrders) {
                witerPrivileges.invoiceSecurity.actions.pendingOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.adjPrice) {
                witerPrivileges.invoiceSecurity.actions.adjPrice.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.search) {
                witerPrivileges.invoiceSecurity.actions.search.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.reOrder) {
                witerPrivileges.invoiceSecurity.actions.reOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.changeServer) {
                witerPrivileges.invoiceSecurity.actions.changeServer.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.voidItem) {
                witerPrivileges.invoiceSecurity.actions.voidItem.access = true
            }
        }

        /**Customers Security Actions */
        if (witerPrivileges.customerSecurity.actions) {
            if (witerPrivileges.customerSecurity.actions.add) {
                witerPrivileges.customerSecurity.actions.add.access = true
            }
            if (witerPrivileges.customerSecurity.actions.edit) {
                witerPrivileges.customerSecurity.actions.edit.access = true
            }
            if (witerPrivileges.customerSecurity.actions.view) {
                witerPrivileges.customerSecurity.actions.view.access = true
            }

        }

        /**Dine In Security Actions */
        if (witerPrivileges.dineInSecurity.actions) {
            if (witerPrivileges.dineInSecurity.actions.changeTable) {
                witerPrivileges.dineInSecurity.actions.changeTable.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.makeReservation) {
                witerPrivileges.dineInSecurity.actions.makeReservation.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.viewReservations) {
                witerPrivileges.dineInSecurity.actions.viewReservations.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.editReservations) {
                witerPrivileges.dineInSecurity.actions.editReservations.access = true
            }

        }
        /**Salon Security Actions */
        if (witerPrivileges.salonSecurity.actions) {
            if (witerPrivileges.salonSecurity.actions.changeTask) {
                witerPrivileges.salonSecurity.actions.changeTask.access = true
            }
            if (witerPrivileges.salonSecurity.actions.newAppointment) {
                witerPrivileges.salonSecurity.actions.newAppointment.access = true
            }
            if (witerPrivileges.salonSecurity.actions.editAppointment) {
                witerPrivileges.salonSecurity.actions.editAppointment.access = true
            }

        }
        if (witerPrivileges.terminalSecurity.actions) {
            if (witerPrivileges.terminalSecurity.actions.login) {
                witerPrivileges.terminalSecurity.actions.login.access = true
            }
        }

        this.privileges = witerPrivileges
    }

    Cashier() {

        let witerPrivileges = new Privilege();
        for (const key in witerPrivileges) {
            const keyName: keyof Privilege = key as keyof Privilege;
            const nestedObject: any = witerPrivileges[keyName];
            nestedObject.access = false
            if ("actions" in nestedObject) {
                const actions = nestedObject.actions;
                for (const actionKey in actions) {
                    if (actionKey in actions) {
                        actions[actionKey].access = false;
                    }
                    nestedObject.actions = actions;
                }
            }
            witerPrivileges[keyName] = nestedObject;

        }



        /**Invoice Security Actions */
        if (witerPrivileges.invoiceSecurity.actions) {
            if (witerPrivileges.invoiceSecurity.actions.add) {
                witerPrivileges.invoiceSecurity.actions.add.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.edit) {
                witerPrivileges.invoiceSecurity.actions.edit.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.print) {
                witerPrivileges.invoiceSecurity.actions.print.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.view) {
                witerPrivileges.invoiceSecurity.actions.view.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.expandedTicket) {
                witerPrivileges.invoiceSecurity.actions.expandedTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.pendingOrders) {
                witerPrivileges.invoiceSecurity.actions.pendingOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.payOrder) {
                witerPrivileges.invoiceSecurity.actions.payOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.reOrder) {
                witerPrivileges.invoiceSecurity.actions.reOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.orderReady) {
                witerPrivileges.invoiceSecurity.actions.orderReady.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.discountOrder) {
                witerPrivileges.invoiceSecurity.actions.discountOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.surchargeOrder) {
                witerPrivileges.invoiceSecurity.actions.surchargeOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.mergeOrders) {
                witerPrivileges.invoiceSecurity.actions.mergeOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.splitTicket) {
                witerPrivileges.invoiceSecurity.actions.splitTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.expandedTicket) {
                witerPrivileges.invoiceSecurity.actions.expandedTicket.access = true
            }

            if (witerPrivileges.invoiceSecurity.actions.multiSelection) {
                witerPrivileges.invoiceSecurity.actions.multiSelection.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.splitTicket) {
                witerPrivileges.invoiceSecurity.actions.splitTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.pendingOrders) {
                witerPrivileges.invoiceSecurity.actions.pendingOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.changeServer) {
                witerPrivileges.invoiceSecurity.actions.changeServer.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.voidTicket) {
                witerPrivileges.invoiceSecurity.actions.voidTicket.access = true
            }


        }
        /**Salon Security Actions */
        if (witerPrivileges.salonSecurity.actions) {
            if (witerPrivileges.salonSecurity.actions.changeTask) {
                witerPrivileges.salonSecurity.actions.changeTask.access = true
            }
            if (witerPrivileges.salonSecurity.actions.newAppointment) {
                witerPrivileges.salonSecurity.actions.newAppointment.access = true
            }
            if (witerPrivileges.salonSecurity.actions.editAppointment) {
                witerPrivileges.salonSecurity.actions.editAppointment.access = true
            }



        }

        if (witerPrivileges.dailyOpertionSecurity.actions) {
            if (witerPrivileges.dailyOpertionSecurity.actions.dailyOpertion) {
                witerPrivileges.dailyOpertionSecurity.actions.dailyOpertion.access = true
            }
            if (witerPrivileges.dailyOpertionSecurity.actions.dailySalesReport) {
                witerPrivileges.dailyOpertionSecurity.actions.dailySalesReport.access = true
            }
        }

        /**Customers Security Actions */
        if (witerPrivileges.customerSecurity.actions) {
            if (witerPrivileges.customerSecurity.actions.add) {
                witerPrivileges.customerSecurity.actions.add.access = true
            }
            if (witerPrivileges.customerSecurity.actions.edit) {
                witerPrivileges.customerSecurity.actions.edit.access = true
            }
            if (witerPrivileges.customerSecurity.actions.view) {
                witerPrivileges.customerSecurity.actions.view.access = true
            }

        }

        /**Dine In Security Actions */
        if (witerPrivileges.dineInSecurity.actions) {
            if (witerPrivileges.dineInSecurity.actions.changeTable) {
                witerPrivileges.dineInSecurity.actions.changeTable.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.makeReservation) {
                witerPrivileges.dineInSecurity.actions.makeReservation.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.viewReservations) {
                witerPrivileges.dineInSecurity.actions.viewReservations.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.editReservations) {
                witerPrivileges.dineInSecurity.actions.editReservations.access = true
            }

        }

        /**call  Security Actions */
        if (witerPrivileges.callSecurity.actions) {
            if (witerPrivileges.callSecurity.actions.callHistory) {
                witerPrivileges.callSecurity.actions.callHistory.access = true
            }
            if (witerPrivileges.callSecurity.actions.pickupCall) {
                witerPrivileges.callSecurity.actions.pickupCall.access = true
            }
            if (witerPrivileges.callSecurity.actions.deliveryCall) {
                witerPrivileges.callSecurity.actions.deliveryCall.access = true
            }
        }
        /**delivery  Security Actions */

        if (witerPrivileges.deliverySecurity.actions) {
            if (witerPrivileges.deliverySecurity.actions.assignDriver) {
                witerPrivileges.deliverySecurity.actions.assignDriver.access = true
            }
            if (witerPrivileges.deliverySecurity.actions.driverArrival) {
                witerPrivileges.deliverySecurity.actions.driverArrival.access = true
            }
            if (witerPrivileges.deliverySecurity.actions.driverReport) {
                witerPrivileges.deliverySecurity.actions.driverReport.access = true
            }
        }

        /**Cashier Security Actions */
        if (witerPrivileges.cashierSecurity.actions) {
            if (witerPrivileges.cashierSecurity.actions.cashier) {
                witerPrivileges.cashierSecurity.actions.cashier.access = true
            }

        }
        /**House Of Account  Actions */
        if (witerPrivileges.houseAccountSecurity.actions) {
            if (witerPrivileges.houseAccountSecurity.actions.houseAccount) {
                witerPrivileges.houseAccountSecurity.actions.houseAccount.access = true
            }
            if (witerPrivileges.houseAccountSecurity.actions.moveToHouseAccount) {
                witerPrivileges.houseAccountSecurity.actions.moveToHouseAccount.access = true
            }
            if (witerPrivileges.houseAccountSecurity.actions.payHouseAccount) {
                witerPrivileges.houseAccountSecurity.actions.payHouseAccount.access = true
            }
        }

        if (witerPrivileges.terminalSecurity.actions) {
            if (witerPrivileges.terminalSecurity.actions.login) {
                witerPrivileges.terminalSecurity.actions.login.access = true
            }
        }
        this.privileges = witerPrivileges
    }

    Supervisor() {

        let witerPrivileges = new Privilege();
        for (const key in witerPrivileges) {
            const keyName: keyof Privilege = key as keyof Privilege;
            const nestedObject: any = witerPrivileges[keyName];
            nestedObject.access = false
            if ("actions" in nestedObject) {
                const actions = nestedObject.actions;
                for (const actionKey in actions) {
                    if (actionKey in actions) {
                        actions[actionKey].access = false;
                    }
                    nestedObject.actions = actions;
                }
            }
            witerPrivileges[keyName] = nestedObject;

        }



        /**Invoice Security Actions */
        if (witerPrivileges.invoiceSecurity.actions) {
            if (witerPrivileges.invoiceSecurity.actions.add) {
                witerPrivileges.invoiceSecurity.actions.add.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.edit) {
                witerPrivileges.invoiceSecurity.actions.edit.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.print) {
                witerPrivileges.invoiceSecurity.actions.print.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.view) {
                witerPrivileges.invoiceSecurity.actions.view.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.expandedTicket) {
                witerPrivileges.invoiceSecurity.actions.expandedTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.pendingOrders) {
                witerPrivileges.invoiceSecurity.actions.pendingOrders.access = true
            }

            if (witerPrivileges.invoiceSecurity.actions.return) {
                witerPrivileges.invoiceSecurity.actions.return.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.payOrder) {
                witerPrivileges.invoiceSecurity.actions.payOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.voidTicket) {
                witerPrivileges.invoiceSecurity.actions.voidTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.voidItem) {
                witerPrivileges.invoiceSecurity.actions.voidItem.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.adjPrice) {
                witerPrivileges.invoiceSecurity.actions.adjPrice.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.reOrder) {
                witerPrivileges.invoiceSecurity.actions.reOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.orderReady) {
                witerPrivileges.invoiceSecurity.actions.orderReady.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.discountOrder) {
                witerPrivileges.invoiceSecurity.actions.discountOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.surchargeOrder) {
                witerPrivileges.invoiceSecurity.actions.surchargeOrder.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.mergeOrders) {
                witerPrivileges.invoiceSecurity.actions.mergeOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.splitTicket) {
                witerPrivileges.invoiceSecurity.actions.splitTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.expandedTicket) {
                witerPrivileges.invoiceSecurity.actions.expandedTicket.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.changeServer) {
                witerPrivileges.invoiceSecurity.actions.changeServer.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.multiSelection) {
                witerPrivileges.invoiceSecurity.actions.multiSelection.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.search) {
                witerPrivileges.invoiceSecurity.actions.search.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.closedOrders) {
                witerPrivileges.invoiceSecurity.actions.closedOrders.access = true
            }
            if (witerPrivileges.invoiceSecurity.actions.pendingOrders) {
                witerPrivileges.invoiceSecurity.actions.pendingOrders.access = true
            }
        }

        /**Customers Security Actions */
        if (witerPrivileges.salonSecurity.actions) {
            if (witerPrivileges.salonSecurity.actions.changeTask) {
                witerPrivileges.salonSecurity.actions.changeTask.access = true
            }
            if (witerPrivileges.salonSecurity.actions.newAppointment) {
                witerPrivileges.salonSecurity.actions.newAppointment.access = true
            }
            if (witerPrivileges.salonSecurity.actions.editAppointment) {
                witerPrivileges.salonSecurity.actions.editAppointment.access = true
            }



        }

        if (witerPrivileges.dailyOpertionSecurity.actions) {
            if (witerPrivileges.dailyOpertionSecurity.actions.dailyOpertion) {
                witerPrivileges.dailyOpertionSecurity.actions.dailyOpertion.access = true
            }
            if (witerPrivileges.dailyOpertionSecurity.actions.dailySalesReport) {
                witerPrivileges.dailyOpertionSecurity.actions.dailySalesReport.access = true
            }
            if (witerPrivileges.dailyOpertionSecurity.actions.cashierHistory) {
                witerPrivileges.dailyOpertionSecurity.actions.cashierHistory.access = true
            }
            if (witerPrivileges.dailyOpertionSecurity.actions.manageCashierOut) {
                witerPrivileges.dailyOpertionSecurity.actions.manageCashierOut.access = true
            }
        }

        /**Customers Security Actions */
        if (witerPrivileges.customerSecurity.actions) {
            if (witerPrivileges.customerSecurity.actions.add) {
                witerPrivileges.customerSecurity.actions.add.access = true
            }
            if (witerPrivileges.customerSecurity.actions.edit) {
                witerPrivileges.customerSecurity.actions.edit.access = true
            }
            if (witerPrivileges.customerSecurity.actions.view) {
                witerPrivileges.customerSecurity.actions.view.access = true
            }

        }

        /**Dine In Security Actions */
        if (witerPrivileges.dineInSecurity.actions) {
            if (witerPrivileges.dineInSecurity.actions.changeTable) {
                witerPrivileges.dineInSecurity.actions.changeTable.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.makeReservation) {
                witerPrivileges.dineInSecurity.actions.makeReservation.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.viewReservations) {
                witerPrivileges.dineInSecurity.actions.viewReservations.access = true
            }
            if (witerPrivileges.dineInSecurity.actions.editReservations) {
                witerPrivileges.dineInSecurity.actions.editReservations.access = true
            }

        }

        /**call  Security Actions */
        if (witerPrivileges.callSecurity.actions) {
            if (witerPrivileges.callSecurity.actions.callHistory) {
                witerPrivileges.callSecurity.actions.callHistory.access = true
            }
            if (witerPrivileges.callSecurity.actions.pickupCall) {
                witerPrivileges.callSecurity.actions.pickupCall.access = true
            }
            if (witerPrivileges.callSecurity.actions.deliveryCall) {
                witerPrivileges.callSecurity.actions.deliveryCall.access = true
            }
        }
        /**delivery  Security Actions */

        if (witerPrivileges.deliverySecurity.actions) {
            if (witerPrivileges.deliverySecurity.actions.assignDriver) {
                witerPrivileges.deliverySecurity.actions.assignDriver.access = true
            }
            if (witerPrivileges.deliverySecurity.actions.driverArrival) {
                witerPrivileges.deliverySecurity.actions.driverArrival.access = true
            }
            if (witerPrivileges.deliverySecurity.actions.driverReport) {
                witerPrivileges.deliverySecurity.actions.driverReport.access = true
            }
        }

        /**Cashier Security Actions */
        if (witerPrivileges.cashierSecurity.actions) {
            if (witerPrivileges.cashierSecurity.actions.cashier) {
                witerPrivileges.cashierSecurity.actions.cashier.access = true
            }

        }
        /**House Of Account  Actions */
        if (witerPrivileges.houseAccountSecurity.actions) {
            if (witerPrivileges.houseAccountSecurity.actions.houseAccount) {
                witerPrivileges.houseAccountSecurity.actions.houseAccount.access = true
            }
            if (witerPrivileges.houseAccountSecurity.actions.moveToHouseAccount) {
                witerPrivileges.houseAccountSecurity.actions.moveToHouseAccount.access = true
            }
            if (witerPrivileges.houseAccountSecurity.actions.payHouseAccount) {
                witerPrivileges.houseAccountSecurity.actions.payHouseAccount.access = true
            }
        }

        if (witerPrivileges.terminalSecurity.actions) {
            if (witerPrivileges.terminalSecurity.actions.terminalSettings) {
                witerPrivileges.terminalSecurity.actions.terminalSettings.access = true
            }

            if (witerPrivileges.terminalSecurity.actions.minimize) {
                witerPrivileges.terminalSecurity.actions.minimize.access = true
            }
            if (witerPrivileges.terminalSecurity.actions.login) {
                witerPrivileges.terminalSecurity.actions.login.access = true
            }
        }



        this.privileges = witerPrivileges
    }
}
export interface actionsTemp {
    name: string,
    access: boolean,
}

export interface actions {
    add?: actionsTemp,
    edit?: actionsTemp,
    print?: actionsTemp,
    view?: actionsTemp,
    convert?: actionsTemp,
    refund?: actionsTemp,
    applyCredit?: actionsTemp
    return?: actionsTemp
    payOrder?: actionsTemp
    voidTicket?: actionsTemp
    voidItem?: actionsTemp
    adjPrice?: actionsTemp
    reOrder?: actionsTemp
    orderReady?: actionsTemp
    discountOrder?: actionsTemp
    surchargeOrder?: actionsTemp
    mergeOrders?: actionsTemp
    splitTicket?: actionsTemp
    expandedTicket?: actionsTemp
    changeServer?: actionsTemp
    multiSelection?: actionsTemp
    search?: actionsTemp
    changeTable?: actionsTemp
    makeReservation?: actionsTemp
    viewReservations?: actionsTemp
    editReservations?: actionsTemp
    assignDriver?: actionsTemp
    driverArrival?: actionsTemp
    driverReport?: actionsTemp
    callHistory?: actionsTemp
    pickupCall?: actionsTemp
    deliveryCall?: actionsTemp
    closedOrders?: actionsTemp
    changeEmployee?: actionsTemp
    changeTask?: actionsTemp
    newAppointment?: actionsTemp
    editAppointment?: actionsTemp
    dailyOpertion?: actionsTemp
    dailySalesReport?: actionsTemp
    cashierHistory?: actionsTemp
    manageCashierOut?: actionsTemp
    viewWorkOrder?: actionsTemp
    houseAccount?: actionsTemp
    moveToHouseAccount?: actionsTemp
    terminalSettings?: actionsTemp
    minimize?: actionsTemp
    login?: actionsTemp
    cashier?: actionsTemp
    payHouseAccount?: actionsTemp
    pendingOrders?: actionsTemp
    delete?: actionsTemp
    writeOff?: actionsTemp
    cashDiscount?: actionsTemp
    driverFunctionality?: actionsTemp
    driverDispatcher?: actionsTemp
}

export class Privilege {

    dashboardSecurity: {
        name: string,
        access: boolean
    } = {
            name: "Dashboard Security",
            access: true,
        }

    branchesConnectionSecurity: {
            name: string,
            access: boolean
        } = {
                name: "Branches Connection Security",
                access: true,
            }

    kitchenSectionSecurity: {
        name: string,
        actions: any,
        access: boolean
    } = {
            name: "Kitchen Sections Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Kitchen Sections",
                    access: true
                },
                view: {
                    name: "View Kitchen Sections",
                    access: true
                }
            }
        }

    companySettingsSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Company Settings Security",
            access: true,
            actions: {
                edit: {
                    name: " Edit Company Settings ",
                    access: true
                },
                view: {
                    name: "View Company Settings ",
                    access: true
                }
            }
        }

        

    tableManagmentSecurity: {
        name: string,
        access: boolean
    } = {
            name: "Table Managment Security",
            access: true,
        }

    recieptBuilderSecurity: {
        name: string,
        access: boolean
    } = {
            name: "Reciept Builder Security",
            access: true,
        }

    labelBuilderSecurity: {
        name: string,
        access: boolean
    } = {
            name: "Label Builder Security",
            access: true,
        }

    serviceSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Service Security",
            access: true,
            actions: {
                add: {
                    name: " add Service  ",
                    access: true
                },
                view: {
                    name: "View Service  ",
                    access: true
                }
            }
        }

    menuBuilderSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Menu Builder Security",
            access: true,
            actions: {
                add: {
                    name: " add Menu  ",
                    access: true
                },
                view: {
                    name: "View Menu  ",
                    access: true
                }
            }
        }

    taxSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Tax Settings Security",
            access: true,
            actions: {
                add: {
                    name: " add Tax  ",
                    access: true
                },
                view: {
                    name: "View Tax  ",
                    access: true
                }
            }
        }

    surchargeSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Surcharge Settings Security",
            access: true,
            actions: {
                add: {
                    name: " add Surcharge  ",
                    access: true
                },
                view: {
                    name: "View Surcharge  ",
                    access: true
                }
            }
        }

    paymentMethodSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Payment Method Security",
            access: true,
            actions: {
                add: {
                    name: " add Payment Method   ",
                    access: true
                },
                view: {
                    name: "View Payment Method   ",
                    access: true
                }
            }
        }

        priceChangeSecurity: {
            name: string,
            actions: actions,
            access: boolean
        } = {
                name: "Price Change Security",
                access: true,
                actions: {
                    add: {
                        name: "add Price Change",
                        access: true
                    },
                    view: {
                        name: "View Price Change",
                        access: true
                    }
                }
            }


    priceLabelSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Price Label Security",
            access: true,
            actions: {
                add: {
                    name: " add Price Label   ",
                    access: true
                },
                view: {
                    name: "View Price Label  ",
                    access: true
                }
            }
        }

    priceManagementSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Price Managment Security",
            access: true,
            actions: {
                add: {
                    name: " add Price Managment  ",
                    access: true
                },
                view: {
                    name: "View Price Managment  ",
                    access: true
                }
            }
        }
    discountSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Discount Security",
            access: true,
            actions: {
                add: {
                    name: " add Discounts ",
                    access: true
                },
                view: {
                    name: "View Discounts  ",
                    access: true
                }
            }
        }

    productSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Products Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Product",
                    access: true
                },
                view: {
                    name: "View Product",
                    access: true
                }
            }
        }

        productsCollectionsSecurity: {
            name: string,
            actions: actions,
            access: boolean
        } = {
                name: "Products Collections Security",
                access: true,
                actions: {
                    add: {
                        name: "Add New Products Collections",
                        access: true
                    },
                    view: {
                        name: "Add New Products Collections",
                        access: true
                    }
                }
            }

    departmentSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Department Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Department",
                    access: true
                },
                view: {
                    name: "View Department",
                    access: true
                }
            }
        }

    categorySecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Category Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Category",
                    access: true
                },
                view: {
                    name: "View Category",
                    access: true
                }
            }
        }

    privilegeSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Privilege Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Privilege",
                    access: true
                },
                view: {
                    name: "View Privilege",
                    access: true
                }
            }
        }

    accountSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Account Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Account",
                    access: true
                },
                view: {
                    name: "View Account",
                    access: true
                }
            }
        }

    customerSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Customers Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Customer",
                    access: true
                },
                edit: {
                    name: "Edit Customers",
                    access: true
                },
                view: {
                    name: "View Customers",
                    access: true
                }
            }
        }

    manualJournalSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Manual Journal Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Manual Journal",
                    access: true
                },
                edit: {
                    name: "Edit Manual Journal",
                    access: true
                },
                view: {
                    name: "View Manual Journal",
                    access: true
                }
            }
        }


    optionGroupSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Option Group Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Option Group",
                    access: true
                },
                view: {
                    name: "View Option Group",
                    access: true
                }
            }
        }

    optionSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Option Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Option",
                    access: true
                },
                view: {
                    name: "View Option",
                    access: true
                }
            }
        }

    estimateSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Estimate Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Estimate",
                    access: true
                },
                edit: {
                    name: "Edit Estimates",
                    access: true
                },
                print: {
                    name: "Print Estimates",
                    access: true
                },
                view: {
                    name: "View Estimates",
                    access: true
                },
                convert: {
                    name: "Convert Estimates to Invoice",
                    access: true
                }
            }
        }

    invoiceSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Invoice Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Invoice",
                    access: true
                },
                edit: {
                    name: "Edit Invoice",
                    access: true
                },
                print: {
                    name: "Print Invoice",
                    access: true
                },
                view: {
                    name: "View Invoice",
                    access: true
                },
                return: {
                    name: "Return Invoice",
                    access: true
                },
                payOrder: {
                    name: "Pay Order",
                    access: true
                },
                voidTicket: {
                    name: "void Ticket",
                    access: true
                },

                voidItem: {
                    name: "Void Invoice Item",
                    access: true
                },
                adjPrice: {
                    name: "Adjust Item Price",
                    access: true
                },
                reOrder: {
                    name: "Reorder",
                    access: true
                },
                orderReady: {
                    name: "Mark Order As Ready",
                    access: true
                },
                discountOrder: {
                    name: "Apply Discount on Order",
                    access: true
                },
                surchargeOrder: {
                    name: "Apply Surcharge on Order",
                    access: true
                },
                mergeOrders: {
                    name: "Merge Orders",
                    access: true
                },
                splitTicket: {
                    name: "Split Ticket",
                    access: true
                },
                expandedTicket: {
                    name: "Expand Ticket",
                    access: true
                },
                changeServer: {
                    name: "Change Server",
                    access: true
                },
                multiSelection: {
                    name: "Multi Invoice Selections",
                    access: true
                },
                search: {
                    name: "Search Tickets ",
                    access: true
                },
                closedOrders: {
                    name: "View Closed Orders",
                    access: true
                },

                pendingOrders: {
                    name: "View Pending Orders",
                    access: true
                },
                writeOff: {
                    name: "Wirte Off Invoices",
                    access: true
                },
                delete: {
                    name: "Delete Invoices",
                    access: true
                },
                cashDiscount: {
                    name: "Cash Discount",
                    access: true
                }
            }
        }

    invoicePaymentsSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Invoice Payments Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Invoice Payments",
                    access: true
                },
                edit: {
                    name: "Edit Invoice Payments",
                    access: true
                },
                print: {
                    name: "Print Invoice Payments",
                    access: true
                },
                view: {
                    name: "View Invoice Payments",
                    access: true
                },
                delete: {
                    name: "Delete Invoice Payments",
                    access: true
                }
            }
        }


    workOrderSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Work Order Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Work Order",
                    access: true
                },
                edit: {
                    name: "Edit Work Order",
                    access: true
                },
                view: {
                    name: "View Work Order",
                    access: true
                }
            }
        }


    creditNoteSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Credit Note Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Credit Note",
                    access: true
                },
                edit: {
                    name: "Edit Credit Note",
                    access: true
                },
                print: {
                    name: "Print Credit Note",
                    access: true
                },
                view: {
                    name: "View Credit Note",
                    access: true
                },
                refund: {
                    name: "Refund Credit Note",
                    access: true
                },
                applyCredit: {
                    name: "Apply Credit On Invoice",
                    access: true
                }
            }
        }
    supplierSecurity: {
        name: string,
        actions: actions
        access: boolean
    } = {
            name: "Supplier Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Supplier",
                    access: true
                },
                edit: {
                    name: "Edit Supplier",
                    access: true
                },
                view: {
                    name: "View Supplier",
                    access: true
                }
            }
        }

    purchaseOrderSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Purchase Order Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Purchase Order",
                    access: true
                },
                edit: {
                    name: "Edit Purchase Order",
                    access: true
                },
                view: {
                    name: "View Purchase Order",
                    access: true
                },
                convert: {
                    name: "Convert  Purchase Order to Bill",
                    access: true
                }
            }
        }



    billingSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Billing Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Bill",
                    access: true
                },
                edit: {
                    name: "Edit Bill",
                    access: true
                },
                view: {
                    name: "View Bill",
                    access: true
                },
                print: {
                    name: "Print Bill",
                    access: true
                },
                delete: {
                    name: "Delete Bill",
                    access: true
                }
            }
        }

    billingPaymentsSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Billing Payments Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Billing Payment",
                    access: true
                },
                edit: {
                    name: "Edit Billing Payment",
                    access: true
                },
                view: {
                    name: "View Billing Payment",
                    access: true
                },
                print: {
                    name: "Print Billing Payment",
                    access: true
                },
                delete: {
                    name: "Delete Billing Payment",
                    access: true
                }
            }
        }


    expenseSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Expense Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Expense Security",
                    access: true
                },
                edit: {
                    name: "Edit Expense Security",
                    access: true
                },
                view: {
                    name: "View Expense Security",
                    access: true
                },
                print: {
                    name: "Print Expense Security",
                    access: true
                }
            }
        }

    supplierCredit: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Supplier Credit Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Supplier Credit Security",
                    access: true
                },
                edit: {
                    name: "Edit Supplier Credit Security",
                    access: true
                },
                view: {
                    name: "View Supplier Credit Security",
                    access: true
                },
                print: {
                    name: "Print Supplier Credit Security",
                    access: true
                }
            }
        }

    dineInSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Dine In Security",
            access: true,
            actions: {
                changeTable: {
                    name: "Change Table",
                    access: true
                },
                makeReservation: {
                    name: "Make Reservation",
                    access: true
                },
                viewReservations: {
                    name: "View Reservations",
                    access: true
                },
                editReservations: {
                    name: "Edit Reservations",
                    access: true
                }
            }
        }

    deliverySecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Delivery Security",
            access: true,
            actions: {
                assignDriver: {
                    name: "Assign Driver",
                    access: true
                },
                driverArrival: {
                    name: "Mark Driver as Arrive",
                    access: true
                },
                driverReport: {
                    name: "View Driver Report",
                    access: true
                },
                driverFunctionality: {
                    name: "Driver Functionality",
                    access: true
                },
                driverDispatcher: {
                    name: "Driver Dispatcher",
                    access: true
                }
            }
        }

    callSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Call Security",
            access: true,
            actions: {
                callHistory: {
                    name: "View Call History",
                    access: true
                },
                pickupCall: {
                    name: "Pickup Call",
                    access: true
                },
                deliveryCall: {
                    name: "Delivery Call",
                    access: true
                }
            }
        }

    salonSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Salon Security",
            access: true,
            actions: {
                changeTask: {
                    name: "Change Task",
                    access: true
                },
                newAppointment: {
                    name: "Add New Appointment",
                    access: true
                },
                editAppointment: {
                    name: "Edit Appointment",
                    access: true
                }
            }
        }

    dailyOpertionSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Daily Opertion Security",
            access: true,
            actions: {
                dailyOpertion: {
                    name: "Access Daily Opertion",
                    access: true
                },
                dailySalesReport: {
                    name: "View Daily Sales Reports",
                    access: true
                },
                cashierHistory: {
                    name: "View Cashier History",
                    access: true
                },
                manageCashierOut: {
                    name: "Manage CashierOut",
                    access: true
                }
            }
        }

        
    reportsSecurity: {
        name: string,
        actions: {
            [key: string]: actionsTemp
        },
        access: boolean
    } = {
            name: "Reports Security",
            access: true,
            actions: {
                "ProfitandLoss": {
                    name: "Profit and Loss",
                    access: true
                },
                "BalanceSheet": {
                    name: "Balance Sheet",
                    access: true
                },
                "TrialBalanceBasisAccrual": {
                    name: "Trial Balance Basis: Accrual",
                    access: true
                },
                "JournalEntries": {
                    name: "Journal Entries",
                    access: true
                },
                "GeneralInventoryReport": {
                    name: "General Inventory Report",
                    access: true
                },
                "ProductMovment": {
                    name: "Product Movment",
                    access: true
                },
                "SalesVsInventoryUsage": {
                    name: "Sales Vs Inventory Usage",
                    access: true
                },
                "ProductSalesVsInventoryUsage": {
                    name: "Product Sales Vs Inventory Usage",
                    access: true
                },
                "ProductInventoryUsage": {
                    name: "Product Inventory Usage",
                    access: true
                },
                "SalesByCategory": {
                    name: "Sales By Category",
                    access: true
                },
                "SalesByItem": {
                    name: "Sales By Item",
                    access: true
                },
                "SalesByDepartment": {
                    name: "Sales By Department",
                    access: true
                },
                "SalesByService": {
                    name: "Sales By Service",
                    access: true
                },
                "SalesByEmployee": {
                    name: "Sales By Employee",
                    access: true
                },
                "SalesByEmployeeVsProducts": {
                    name: "Sales By Employee Vs Products",
                    access: true
                },
                "SalesReportByPeriod": {
                    name: "Sales Report By Period",
                    access: true
                },
                "SalesByTerminal": {
                    name: "Sales By Terminal",
                    access: true
                },
                "SalesByTables": {
                    name: "Sales By Tables",
                    access: true
                },
                "SalesByTableGroups": {
                    name: "Sales By Table Groups",
                    access: true
                },
                "SalesByInvoicesReadyTime": {
                    name: "Sales By Invoices Ready Time",
                    access: true
                },
                "SalesByDeliveryArea": {
                    name: "Sales By Delivery Area",
                    access: true
                },
                "SalesByMenuItemsProductsVsOptions": {
                    name: "Sales By Menu Items Products Vs Options",
                    access: true
                },
                "SalesByServiceVsMenuItemProducts": {
                    name: "Sales By Service Vs Menu Item Products",
                    access: true
                },
                "CashierReport": {
                    name: "Cashier Report",
                    access: true
                },
                "DriverDetailsReport": {
                    name: "Driver Details Report",
                    access: true
                },
                "DriverReport": {
                    name: "Driver Report",
                    access: true
                },
                "SalesByMenu": {
                    name: "Sales By Menu",
                    access: true
                },
                "SalesByMenuSections": {
                    name: "Sales By Menu Sections",
                    access: true
                },
                "SalesByMenuProductsCategory": {
                    name: "Sales By Menu Products Category",
                    access: true
                },
                "CustomerOrderHistory": {
                    name: "Customer Order History",
                    access: true
                },
                "PaymentMethodReport": {
                    name: "Payment Method Report",
                    access: true
                },
                "ProductPreparedTimeSummary": {
                    name: "Product Prepared Time Summary",
                    access: true
                },
                "ShortOverReport": {
                    name: "Short Over Report",
                    access: true
                },
                "CustomerAgingReport": {
                    name: "Customer Aging Report",
                    access: true,
               
                },
                "CustomerAgingSummaryReport": {
                    name: "Customer Aging Summary Report",
                    access: true,
                },
                "SupplierAgingReport": {
                    name: "Supplier Aging Report",
                    access: true,
                   
                },
                "SupplierAgingSummaryReport": {
                    name: "Supplier Aging Summary Report",
                    access: true,
          
                },

            }
        }


    cashierSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "cashier Security",
            access: true,
            actions: {
                cashier: {
                    name: "Cashier In/Out",
                    access: true
                }
            }
        }

    houseAccountSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "House Account Security",
            access: true,
            actions: {
                houseAccount: {
                    name: "Access House Account",
                    access: true
                },
                moveToHouseAccount: {
                    name: "Move to House Account ",
                    access: true
                },
                payHouseAccount: {
                    name: "Pay House Account ",
                    access: true
                }
            }
        }


    recipeSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Recipe Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Recipe",
                    access: true
                },
                view: {
                    name: "View Recipe",
                    access: true
                }
            }
        }

    mediaSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Media Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Media",
                    access: true
                },
                view: {
                    name: "View Media",
                    access: true
                },
            }
        }

    employeeSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Employee Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Employee",
                    access: true
                },
                view: {
                    name: "View Employee",
                    access: true
                },
            }
        }

    employeeScheduleSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Employee Schedule Security",
            access: true,
            actions: {
                view: {
                    name: "Control Schedule",
                    access: true
                },
            }
        }

    inventoryPhysicalCountsSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Physical Counts Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Physical Counts",
                    access: true
                },
                view: {
                    name: "View Physical Counts",
                    access: true
                },
            }
        }

    inventoryTransferSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Inventory Transfer Security",
            access: true,
            actions: {
                add: {
                    name: "Add New Inventory Transfer",
                    access: true
                },
                view: {
                    name: "View Inventory Transfer",
                    access: true
                },
            }
        }

    websiteBuilderSecurity: {
        name: string,
        access: boolean
    } = {
            name: "Website Builder Security",
            access: true,
        }


    branchSettingsSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Branch Settings Security",
            access: true,
            actions: {
                edit: {
                    name: "Edit Branch Settings",
                    access: true
                }
            }
        }
    terminalSecurity: {
        name: string,
        actions: actions,
        access: boolean
    } = {
            name: "Terminal Security",
            access: true,
            actions: {
                terminalSettings: {
                    name: "Access Terminal Settings",
                    access: true
                },
                minimize: {
                    name: "minimize",
                    access: true
                },
                login: {
                    name: "Login",
                    access: true
                }
            }
        }


    ParseJson(json: any): void {
        for (const key in this) {

            if (json[key] != null) {
                this[key as keyof typeof this] = json[key];
            } else {
                this[key as keyof typeof this] = this[key as keyof typeof this]
            }
        }
    }


}

