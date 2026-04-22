import handlebars from 'handlebars'
import  moment from 'moment';
export class CompileHtml{

    public static getCompileHtmlInstance(){
        
        handlebars.registerHelper('isEqual', (a, b, options: handlebars.HelperOptions) => {
            return  a === b
         });

         handlebars.registerHelper('isNotEqual', (a, b, options: handlebars.HelperOptions) => {
          return  a != b
       });

       handlebars.registerHelper('isLessThan', (a, b, options) => {
        return  a < b
        });

     handlebars.registerHelper('isNotEqual', (a, b, options: handlebars.HelperOptions) => {
      return  a != b
    });


         handlebars.registerHelper('notEmpty', (value, options)=> {
            return value   != null && value !=''
           });
           
           handlebars.registerHelper('isEmpty', (value, options)=> {
             return value == "" || value == null
            });

           handlebars.registerHelper('greaterThanZero', (value, options)=> {
             return value  >0
            });

            handlebars.registerHelper('equivalentAmount', (a, b, options) => {
              return  a*b
            });

            handlebars.registerHelper('formatCurrency', function(value, currencySymbol, afterDecimal) {
               // Parse the value as a number

               
                const number = Number(value);
                
                // Check if the number is valid
                if (isNaN(number)) {
                  return value; // Return the original value if it's not a valid number
                }
              
                // Format the number as currency with the provided symbol and decimal places
                const formatted = number.toLocaleString(undefined, {
                  style: 'currency',
                  currency:currencySymbol??'BHD',
                  minimumFractionDigits:  afterDecimal ??3,
                  maximumFractionDigits: afterDecimal??3
                });

                
              
                return formatted;


          
              
            });

            handlebars.registerHelper('formatDeciamlPlace', function(value,  afterDecimal) {
              // Parse the value as a number

              
               const number = Number(value);
               
               // Check if the number is valid
               if (isNaN(number)) {
                 return value; // Return the original value if it's not a valid number
               }
             
               // Format the number as currency with the provided symbol and decimal places
               const formatted = number.toLocaleString(undefined, {
                 minimumFractionDigits:  afterDecimal ??3,
                 maximumFractionDigits: afterDecimal??3
               });

               
             
               return formatted;


         
             
           });

       

              handlebars.registerHelper('formatDate', function(value) {
     
                return moment(value).format('DD/MM/YYYY');
              });

            return handlebars;
    }
}