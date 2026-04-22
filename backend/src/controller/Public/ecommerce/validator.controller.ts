import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
export class Validator {

    public static validateEmployeeSchedule = [
        body('branchId')
            .isUUID()
            .withMessage('branchId must be a valid UUID'),
        body('from')
            .isISO8601()
            .toDate()
            .withMessage('from must be a valid date in ISO 8601 format'),
        body('to')
            .isISO8601()
            .toDate()
            .withMessage('to must be a valid date in ISO 8601 format'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];




    public static EmployeesScheduleForAppointment = [
        body('branchId')
            .isUUID()
            .withMessage('branchId must be a valid UUID'),
        body('date')
            .isISO8601()
            .toDate()
            .withMessage('date must be a valid date in ISO 8601 format'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static getMenuSections = [
        body('branchId')
            .isUUID()
            .withMessage('branchId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static loadQrData = [

        // Validate branchId as a UUID
        param('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        // Validate tableId as a UUID
        param('tableId').isUUID().withMessage('tableId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            console.log("test")
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static branchId = [

        // Validate branchId as a UUID
        param('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static invoiceId = [

        // Validate branchId as a UUID
        param('invoiceId').isUUID().withMessage('invoiceId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static id = [

        // Validate branchId as a UUID
        param('id').isString().withMessage('id must be a valid'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static sessionId = [

        // Validate branchId as a UUID
        param('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];
    public static userSession = [

        // Validate branchId as a UUID
        body('userSession').isUUID().withMessage('userSession must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static checkOTP = [

        // Validate branchId as a UUID
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('OTP').isInt().withMessage('OTP must be an integer'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static setNewPassword = [

        // Validate branchId as a UUID
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('OTP').isInt().withMessage('OTP must be an integer'),
        body('password').isString().withMessage('password must be an string'),

        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];
    public static phone = [

        // Validate branchId as a UUID
        body('phone').isInt().withMessage('phone must be an integer'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];






    public static getProductTags = [

        // Validate branchId as a UUID
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('priceFilter').isObject().optional().withMessage('priceFilter must be an object'),
        body('priceFilter.min').isNumeric().optional().withMessage('Min price must be a number'),
        body('priceFilter.max').isNumeric().optional().withMessage('Max price must be a number'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static branchIdPost = [

        // Validate branchId as a UUID
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];



    public static branchIdAndProductId = [

        // Validate branchId as a UUID
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('productId').isUUID().withMessage('productId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static branchIdAndEmployeeId = [

        // Validate branchId as a UUID
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('employeeId').isUUID().withMessage('productId must be a valid UUID'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];
    public static logIn = [

        // Validate branchId as a UUID
        body('username').isString().withMessage('branchId must be a String'),
        body('password').isString().withMessage('productId must be a String'),
        // Validate tableId as a UUID
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static getMenuProducts = [
        body('page').isInt({ min: 1 }).withMessage('Page must be an integer greater than 0'),
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('limit').isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
        body('sectionId').isUUID().optional().withMessage('sectionId must be a valid UUID'),
        body('tags').isArray().optional().withMessage('Tags must be an array'),
        body('tags.*').isString().withMessage('Each tag must be a string'),
        body('sort').isObject().withMessage('Sort must be an object'),
        body('sort.sortValue').isString().optional().withMessage('sortValue must be a string'),
        body('sort.sortDirection')
            .isIn(['ASC', 'DESC']).optional()
            .withMessage('sortDirection must be either "ASC" or "DESC"'),
        body('priceFilter').isObject().optional().withMessage('priceFilter must be an object'),
        body('priceFilter.min').isNumeric().optional().withMessage('Min price must be a number'),
        body('priceFilter.max').isNumeric().optional().withMessage('Max price must be a number'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];




    public static createCart = [
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('tableId').isUUID().optional().withMessage('tableId must be a valid UUID'),
        body('serviceName').isIn(['Shipping', 'DineIn', 'Delivery', 'Salon', 'PickUp']).withMessage('serviceName must be either "Shipping" or "DineIn" or "Delivery" or "Salon"'),
        body('addressKey').isString().optional().withMessage('addressKey must be a string'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static ChangeService = [
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('serviceName').isIn(['Shipping', 'DineIn', 'Delivery', 'Salon']).withMessage('serviceName must be either "Shipping" or "DineIn" or "Delivery" or "Salon"'),
        body('userSessionId').isUUID().optional().withMessage('userSessionId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];





    public static checkBranchAvailabilty = [
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static addItem = [
        body('qty').isInt({ min: 1 }).withMessage('qty must be an integer greater than 0'),
        body('productId').isUUID().withMessage('productId must be a valid UUID'),
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('userSessionId').isUUID().optional().withMessage('userSessionId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];


    public static changeItemQty = [
        body('qty').isInt({ min: 1 }).withMessage('qty must be an integer greater than 0'),
        body('transactionId').isUUID().withMessage('transactionId must be a valid UUID'),
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('userSessionId').isUUID().optional().withMessage('userSessionId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static removeItem = [
        body('transactionId').isUUID().withMessage('transactionId must be a valid UUID'),
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        body('userSessionId').isUUID().optional().withMessage('userSessionId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];

    public static clearCart = [
        body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];












    public static getServiceProducts = [
        body('page').isInt({ min: 1 }).withMessage('Page must be an integer greater than 0'),
        body('branchId').isUUID().withMessage('branchId must be a valid UUID'),
        body('limit').isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
        body('tags').isArray().optional().withMessage('Tags must be an array'),
        body('tags.*').isString().withMessage('Each tag must be a string'),
        body('sort').isObject().optional().withMessage('Sort must be an object'),
        body('sort.sortValue').isString().optional().withMessage('sortValue must be a string'),
        body('sort.sortDirection')
            .isIn(['ASC', 'DESC']).optional()
            .withMessage('sortDirection must be either "ASC" or "DESC"'),
        body('priceFilter').isObject().optional().withMessage('priceFilter must be an object'),
        body('priceFilter.min').isNumeric().optional().withMessage('Min price must be a number'),
        body('priceFilter.max').isNumeric().optional().withMessage('Max price must be a number'),
        body('searchTerm').isString().optional().withMessage('searchTerm must be a string'),
        body('departmentId').isUUID().optional().withMessage('departmentId tag must be a valid UUID'),
        body('categoryId').isUUID().optional().withMessage('categoryId tag must be a valid UUID'),
        body('brandId').isUUID().optional().withMessage('brandId tag must be a valid UUID'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];




    public static checkOut = [
        body('sessionId')
            .exists().withMessage('Session ID is required.')
            .isUUID().withMessage('Session ID must be a valid UUID.'),
        body('branchId')
            .exists().withMessage('Branch ID is required.')
            .isUUID().withMessage('Branch ID must be a valid UUID.'),
        body('serviceId')
            .exists().withMessage('Service ID is required.')
            .isUUID().withMessage('Service ID must be a valid UUID.'),
        body('serviceName')
            .isIn(['Shipping', 'DineIn', 'Delivery', 'Salon'])
            .withMessage('serviceName must be either "Shipping" or "DineIn" or "Delivery" or "Salon"'),
        body('payment').isObject().withMessage('payment must be an object'),
        body('payment.name')
            .exists().withMessage('Payment name is required.')
            .isString().withMessage('Payment name must be a string.'),
        body('customer').isObject().withMessage('customer must be an object'),
        body('customer.name')
            .exists().withMessage('Customer name is required.')
            .isString().withMessage('Customer name must be a string.'),
        body('customer.phone')
            .exists().withMessage('Customer phone is required.')
            .isString().withMessage('Customer phone must be a string.')
            .isLength({ min: 8, max: 15 }).withMessage('Phone number must be between 8 and 15 characters.'),
        body('customer.address').isObject().withMessage('customer.address must be an object'),
        body('customer.address.country')
            .optional() // Country is nullable, so it's optional
            .isString().withMessage('Country must be a string if provided.'),
        body('time')
            .exists().withMessage('Time is required.')
            .isString().withMessage('Time must be a string.')
            .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:mm format.'),
        body('note').isString().withMessage('note must be a string'),
        body('carNumber').isString().withMessage('carNumber must be a string'),
        body('addressKey').isString().withMessage('addressKey must be a string'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];










    public static payInvoice = [
       
    body('sessionId')
    .exists().withMessage('Session ID is required.')
    .isUUID().withMessage('Session ID must be a valid UUID.'),
    body('payment').isObject().withMessage('payment must be an object'),
    body('payment.name')
        .exists().withMessage('Payment name is required.')
        .isString().withMessage('Payment name must be a string.'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        },
    ];











}


