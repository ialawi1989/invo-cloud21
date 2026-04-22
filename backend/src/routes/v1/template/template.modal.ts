export interface TemplateSample {
  sampleName: string;
  sampleData: object;
}

export interface TemplateContent {
  template: string;
  sample: TemplateSample[];
}

export interface Template{
    id: string,
    companyId: string,
    title: string,
    type: string,
    template:TemplateContent[],
    outputType: string,
    createdBy: string,
    updatedBy: string,
    createdAt: Date,
    updatedAt: Date,
}