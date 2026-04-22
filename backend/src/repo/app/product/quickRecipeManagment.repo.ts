import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { ValidationException } from "@src/utilts/Exception";
import { ProductRepo } from "./product.repo";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";




interface RecipeItem {
  usages?: number;
  usage?: number;
  name: string;
  unitCost: number;
  inventoryId?: string;
  recipeId?: string;
}


export class QuickRecipeManagment {

  //Maps table names to the column that holds the recipe data.
  private static readonly TABLES = {
    recipe: { name: 'Recipe', columnName: 'items' },
    option: { name: 'Options', columnName: 'recipe', },
    menuProduct: { name: 'Products', columnName: 'recipes', }
  };

  public static async calculateUnitCost(prod: any, branchId: string, depth: number = 0): Promise<number> {
    // Fetch the average available unit cost from the repository
    const data = await ProductRepo.get_avg_available_UnitCost(prod.productId, prod.requiredQty, branchId);

    // Case 1: Either no parent or enough stock is available → return direct cost
    if (!prod.parentId || prod.onHand >= prod.requiredQty) {
      return data.cost;
    }

    // Case 2: Shortage exists → calculate cost using parent components
    const takenQty = prod.onHand;
    const remainingQty = prod.requiredQty - takenQty;
    prod.unitCost = data.cost; // Initial cost (partial or outdated, will be recalculated)

    // Determine how many parent units are needed to fulfill the shortage
    const parentRequiredQty = Math.ceil(remainingQty / prod.childQty);
    const parentInfo = await ProductRepo.getParentInfo(prod.parentId, branchId);
    parentInfo.requiredQty = parentRequiredQty;

    // Recursive calculation if we haven’t exceeded the depth limit
    if (depth < 2) {
      const parentUnitCost = await this.calculateUnitCost(parentInfo, branchId, depth + 1);
      const derivedCostFromParent = parentUnitCost / prod.childQty;

      // Weighted average unit cost = (cost from parent + cost of existing stock) / total required
      const totalCost = (derivedCostFromParent * remainingQty) + (prod.unitCost * takenQty);
      prod.unitCost = totalCost / prod.requiredQty;
    }

    return prod.unitCost;
  }


  public static async validateRecipeItem(itemData: { usages: number; usage: number; inventoryId?: string; recipeId?: string; name?: string; }, company: Company, validTypes?: string[]) {

    const { id: companyId } = company;
    const item = { ...itemData };
    const allowedTypes = validTypes && validTypes.length > 0 ? validTypes : ['inventory', 'kit'];

    // 1. Core input validation
    let usagesAmount = item.usage ?? item.usages
    if (usagesAmount <= 0) {
      throw new ValidationException(`Usages for recipe item "${item.name || 'unknown'}" must be greater than zero.`);
    }

    // 2. Determine the query based on item type
    let query: { text: string; values: any[] };

    if (item.inventoryId) {
      query = {
        text: ` SELECT id, name, type, "unitCost", "UOM"
            FROM "Products"
            WHERE "companyId" = $1 AND id = $2`,
        values: [companyId, item.inventoryId],
      };

    } else if (allowedTypes.includes('Recipe') && item.recipeId) {
      query = {
        text: `
        SELECT
          r.id,
          r.name,
          'Recipe' AS type,
          '' AS "UOM",
          COALESCE(SUM(latest."cost" * items."usage"), 0) AS "unitCost"
        FROM "Recipe" r
        JOIN LATERAL jsonb_to_recordset(r.items) AS items("usage" float4, "inventoryId" uuid) ON TRUE
        JOIN "Products" p ON p.id = items."inventoryId"
        LEFT JOIN LATERAL (
          SELECT
            imr."cost"
          FROM "InventoryMovmentRecords" imr
          WHERE imr."companyId" = p."companyId"
            AND imr."productId" = p.id
            AND imr."qty" >= 0
          ORDER BY imr."createdAt" DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE r.id = $2 AND r."companyId" = $1
        GROUP BY r.id, r.name
      `,
        values: [companyId, item.recipeId],
      };
    } else {
      const validIdTypes = allowedTypes.includes('Recipe') ? 'Either inventoryId or recipeId' : 'inventoryId';
      throw new ValidationException(`${validIdTypes} is required.`);
    }

    try {
      const result = await DB.excu.query(query.text, query.values);
      const recipeProduct = result.rows?.[0];

      // 3. Post-query validation
      if (!recipeProduct) {
        throw new ValidationException('Item not found.');
      }

      if (!allowedTypes.includes(recipeProduct.type)) {
        throw new ValidationException(
          `Invalid type "${recipeProduct.type}" for item "${recipeProduct.name}". Must be one of: ${allowedTypes.join(', ')}.`
        );
      }

      // 4. Transform and return the result
      const baseItem = {

        name: recipeProduct.name,
        unitCost: recipeProduct.unitCost,
        ...(item.usages && { usages: item.usages }),
        ...(item.usage && { usage: item.usage }),
        ...(item.inventoryId && { inventoryId: recipeProduct.id }),
        ...(item.recipeId && { recipeId: recipeProduct.id }),
      };


      return baseItem;
    } catch (error: any) {
      // Re-throw ValidationException to avoid losing specific error messages
      if (error instanceof ValidationException) {
        throw error;
      }
      // For all other errors, provide a generic message for security and re-throw
      // while ensuring the original error is logged.
      console.error('An unexpected error occurred during validation.', error);
      throw new Error('Validation failed due to an internal error.');
    }
  }


  /**
   * Saves or updates a recipe item for a given entity.
   *
   * @param {'Options' | 'Products' | 'Recipe'} tableName - The name of the table to update.
   * @param {any} data - The data for the recipe item. This is expected to be validated by a separate function.
   * @param {string} id - The ID of the entity (e.g., Option, Product, Recipe).
   * @param {Company} company - The company object.
   * @returns {Promise<ResponseData<RecipeItem>>} A promise that resolves to a success response with the validated item.
   * @throws {ValidationException} If the entity is not found or validation fails.
   * @throws {Error} For unexpected database or server errors.
   */
  public static async saveRecipeItem(type: keyof typeof this.TABLES, data: any, id: string, company: Company, employeeId: string): Promise<ResponseData> {
    try {

      const companyId = company.id;
      const table = this.TABLES[type];
      const columnName = table.columnName
      const tableName = table.name


      // 1. Fetch the existing entity and its recipe array.
      const fetchQuery = `
        SELECT id, ${columnName}
        FROM "${tableName}"
        WHERE "companyId" = $1 AND id = $2
      `;
      const fetchResult = await DB.excu.query(fetchQuery, [companyId, id]);
      const oldEntity = fetchResult.rows?.[0];

      if (!oldEntity) {
        throw new ValidationException(`${type} not found.`);
      }

      // 2. Validate the new item.

      const validatedItem = await this.validateRecipeItem(data, company, type == 'recipe' ? ['inventory', 'kit'] : ['inventory', 'kit', 'Recipe']);

      // 3. Update the recipe array in memory.
      // Use nullish coalescing for safety.
      const recipe: RecipeItem[] = oldEntity[columnName] ?? [];

      const index = recipe.findIndex(
        (entry) =>
          ('inventoryId' in validatedItem && validatedItem.inventoryId && entry.inventoryId === validatedItem.inventoryId) ||
          ('recipeId' in validatedItem && validatedItem.recipeId && entry.recipeId === validatedItem.recipeId)
      );

      if (index !== -1) {
        // Update the existing item
        recipe[index] = validatedItem;
      } else {
        // Add a new item
        recipe.push(validatedItem);
      }

      // 4. Update the database with the new array.
      const updateQuery = `
        UPDATE "${tableName}"
        SET ${columnName} = $3::jsonb, "updatedDate" = $4
        WHERE id = $1 AND "companyId" = $2
      `;
      await DB.excu.query(updateQuery, [id, companyId, JSON.stringify(recipe), new Date()]);

      let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
        values: [employeeId, companyId]
      }
      let employeeName = (await DB.excu.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;


      let log = new Log();
      log.employeeId = employeeId
      let source_id =  validatedItem.recipeId || validatedItem.inventoryId
      let sourceName = ''

      if (type == 'recipe') {
        sourceName = "Recipe"
        log.action = "Prep Recipe Modified"
        log.comment = `${employeeName} has modified the prep item Recipe of the item (${data.name})`
        log.metaData = {
          "itemName": data.name,
          "recipeType": "prep"
        }

      }
      else if (type == 'menuProduct') {
        sourceName = "MenuRecipe"
        log.action = "Menu Recipe Modified"
        log.comment = `${employeeName} has modified the menu Recipe of the item (${data.name})`
        log.metaData = {
          "itemName": data.name,
          "recipeType": "menu"
        }
      }
      await LogsManagmentRepo.manageLogs(null, sourceName , source_id, [log], null, companyId, employeeId, "", "Cloud")



      return new ResponseData(true, 'Recipe item saved successfully', validatedItem,);

    } catch (error: any) {
      if (error instanceof ValidationException) {
        throw error;
      }
      console.error('Failed to save recipe item:', error);
      throw new Error(error.message || 'An unexpected error occurred while saving the recipe item.');
    }
  }

  /**
   * Deletes a recipe item from a given entity.
   *
   * @param {'Options' | 'Products' | 'Recipe'} tableName - The name of the table to update.
   * @param {string} itemId - The ID of the item to delete (inventoryId or recipeId).
   * @param {string} entityId - The ID of the entity (e.g., Option, Product, Recipe).
   * @param {string} companyId - The company ID.
   * @returns {Promise<ResponseData<{}>>} A promise that resolves to a success or failure response.
   * @throws {Error} For unexpected database or server errors.
   */
  public static async deleteRecipeItem(type: keyof typeof this.TABLES, itemId: string, entityId: string, companyId: string): Promise<ResponseData> {
    try {

      const table = this.TABLES[type];
      const columnName = table.columnName
      const tableName = table.name
      // 1. Fetch the existing entity and its recipe array.
      const fetchQuery = `
        SELECT ${columnName}
        FROM "${tableName}"
        WHERE "companyId" = $1 AND id = $2
      `;
      const fetchResult = await DB.excu.query(fetchQuery, [companyId, entityId]);
      const oldEntity = fetchResult.rows?.[0];

      if (!oldEntity) {
        throw new ValidationException(`${type} not found.`);
      }

      const recipe: RecipeItem[] = oldEntity[columnName] ?? [];
      const updatedRecipe = recipe.filter(
        (item) => item.inventoryId !== itemId && item.recipeId !== itemId
      );

      // If the array size hasn't changed, the item wasn't found.
      if (updatedRecipe.length === recipe.length) {
        throw new ValidationException(`'Recipe item not found.' not found.`);
      }

      // 2. Update the database with the filtered array.
      const updateQuery = `
        UPDATE "${tableName}"
        SET ${columnName} = $3::jsonb, "updatedDate" = $4
        WHERE id = $1 AND "companyId" = $2
      `;
      await DB.excu.query(updateQuery, [entityId, companyId, JSON.stringify(updatedRecipe), new Date()]);

      return new ResponseData(true, 'Recipe item deleted successfully', {})

    } catch (error: any) {
      if (error instanceof ValidationException) {
        throw error;
      }
      console.error('Failed to delete recipe item:', error);
      throw new Error(error.message || 'An unexpected error occurred while deleting the recipe item.');
    }
  }


}

