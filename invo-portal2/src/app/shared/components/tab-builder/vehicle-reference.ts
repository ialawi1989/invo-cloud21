/**
 * Sample make/model/year data used by the Vehicle Fitment picker.
 *
 * TODO: replace with a real backend call (e.g. `company/getVehicleMakes`
 * + `company/getVehicleModels/:makeId`) once that API is available.
 */

export interface VehicleMake  { id: string; name: string; logo: string; }
export interface VehicleModel { id: string; name: string; }

export const SAMPLE_MAKES: VehicleMake[] = [
  { id: 'make_toyota', name: 'Toyota', logo: '🚗' },
  { id: 'make_honda',  name: 'Honda',  logo: '🚙' },
  { id: 'make_ford',   name: 'Ford',   logo: '🛻' },
];

export const SAMPLE_MODELS: Record<string, VehicleModel[]> = {
  make_toyota: [{ id: 'model_camry',   name: 'Camry' },   { id: 'model_corolla', name: 'Corolla' }],
  make_honda:  [{ id: 'model_civic',   name: 'Civic' },   { id: 'model_accord',  name: 'Accord' }],
  make_ford:   [{ id: 'model_f150',    name: 'F-150' },   { id: 'model_mustang', name: 'Mustang' }],
};

export const SAMPLE_YEARS: number[] = (() => {
  const cy = new Date().getFullYear();
  const list: number[] = [];
  for (let y = cy; y >= cy - 10; y--) list.push(y);
  return list;
})();
