"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
class TemplateService {
    static async createTemplate(data) {
        if (!data.triggerType)
            throw new Error('triggerType is required');
        const triggerTypeEnum = client_1.TriggerType[data.triggerType.toUpperCase()];
        if (!triggerTypeEnum)
            throw new Error('Invalid triggerType');
        return index_1.prisma.workflow.create({
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
    static async listTemplates() {
        return index_1.prisma.workflow.findMany({ where: { isPublic: true } });
    }
    static async duplicateTemplate(templateId, userId) {
        const template = await index_1.prisma.workflow.findUnique({ where: { id: templateId } });
        if (!template)
            throw new Error('Template not found');
        const { name, description, definition, triggerType, category, tags } = template;
        const triggerTypeEnum = client_1.TriggerType[String(triggerType).toUpperCase()];
        if (!triggerTypeEnum)
            throw new Error('Invalid triggerType');
        return index_1.prisma.workflow.create({
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
exports.TemplateService = TemplateService;
//# sourceMappingURL=template.service.js.map