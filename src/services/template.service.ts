import { prisma } from '../index';
import { Workflow, TriggerType } from '@prisma/client';

export class TemplateService {
  // Create a new template
  static async createTemplate(data: {
    name: string;
    description?: string;
    definition: any;
    category?: string;
    tags?: string[];
    triggerType: string;
    createdBy: string;
  }) {
    if (!data.triggerType) throw new Error('triggerType is required');
    const triggerTypeEnum = TriggerType[data.triggerType.toUpperCase() as keyof typeof TriggerType];
    if (!triggerTypeEnum) throw new Error('Invalid triggerType');
    return prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        definition: data.definition ?? {},
        category: data.category,
        tags: data.tags,
        triggerType: triggerTypeEnum,
        userId: data.createdBy,
        isPublic: true,
      },
    });
  }

  // List all templates
  static async listTemplates() {
    return prisma.workflow.findMany({ where: { isPublic: true } });
  }

  // Duplicate a template for a user
  static async duplicateTemplate(templateId: string, userId: string) {
    const template = await prisma.workflow.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');
    const { name, description, definition, triggerType, category, tags } = template;
    const triggerTypeEnum = TriggerType[String(triggerType).toUpperCase() as keyof typeof TriggerType];
    if (!triggerTypeEnum) throw new Error('Invalid triggerType');
    return prisma.workflow.create({
      data: {
        name: `${name} (Copy)`,
        description,
        definition: definition ?? {},
        triggerType: triggerTypeEnum,
        category,
        tags,
        userId,
        isPublic: false,
      },
    });
  }
}
