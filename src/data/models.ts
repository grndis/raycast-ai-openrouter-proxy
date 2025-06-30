import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { z } from 'zod/v4';

export const ModelConfig = z.object({
  name: z.string('Model name is required'),
  id: z.string('Model ID is required'),
  contextLength: z
    .int('Context length must be a positive integer')
    .positive('Context length must be a positive integer'),
  capabilities: z.array(
    z.enum(['vision', 'tools'], 'Capabilities must be an array of "vision" and/or "tools"'),
    'Capabilities array is required',
  ),
  temperature: z
    .number('Temperature must be a number between 0 and 2')
    .min(0, 'Temperature must be a number between 0 and 2')
    .max(2, 'Temperature must be a number between 0 and 2')
    .optional(),
  topP: z
    .number('Top P must be a number between 0 and 1')
    .min(0, 'Top P must be a number between 0 and 1')
    .max(1, 'Top P must be a number between 0 and 1')
    .optional(),
  max_tokens: z
    .int('Max tokens must be a positive integer')
    .positive('Max tokens must be a positive integer')
    .optional(),
  extra: z
    .record(z.string(), z.any(), 'Extra properties must be a record of string keys and any values')
    .optional(),
});
export type ModelConfig = z.infer<typeof ModelConfig>;

export function loadModels(): ModelConfig[] | z.ZodError {
  const filePath = path.resolve(__dirname, '../../models.json');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const models = JSON.parse(fileContent);
  const parsedModels = z.array(ModelConfig).safeParse(models);

  if (!parsedModels.success) {
    return parsedModels.error;
  }

  const names = new Set<string>();
  for (const model of parsedModels.data) {
    const lowerName = model.name.toLowerCase();
    if (names.has(lowerName)) {
      throw new Error(`Duplicate model name found: ${model.name}`);
    }
    names.add(lowerName);
  }

  return parsedModels.data;
}

export const findModelConfig = (
  models: ModelConfig[],
  modelName: string,
): ModelConfig | undefined => {
  return models.find((config) => config.name === modelName);
};

function generateDigest(config: ModelConfig): string {
  const data = JSON.stringify({
    name: config.name,
    id: config.id,
    contextLength: config.contextLength,
    capabilities: config.capabilities,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const generateModelsList = (models: ModelConfig[]) => {
  return {
    models: models.map((config) => ({
      name: config.name,
      model: config.id,
      modified_at: new Date().toISOString(),
      size: 500000000, // Fixed size
      digest: generateDigest(config),
      details: {
        parent_model: '',
        format: 'gguf',
        family: 'llama',
        families: ['llama'],
        parameter_size: '7B',
        quantization_level: 'Q4_K_M',
      },
    })),
  };
};

export const generateModelInfo = (models: ModelConfig[], modelName: string) => {
  const config = findModelConfig(models, modelName);

  if (!config) {
    throw new Error(`Model ${modelName} not found`);
  }

  return {
    modelfile: `FROM ${config.name}`,
    parameters: 'stop "<|eot_id|>"',
    template: '{{ .Prompt }}',
    details: {
      parent_model: '',
      format: 'gguf',
      family: 'llama',
      families: ['llama'],
      parameter_size: '7B',
      quantization_level: 'Q4_K_M',
    },
    model_info: {
      'general.architecture': 'llama',
      'general.file_type': 2,
      'general.parameter_count': 7000000000,
      'llama.context_length': config.contextLength,
      'llama.embedding_length': 4096,
      'tokenizer.ggml.model': 'gpt2',
    },
    capabilities: ['completion', ...config.capabilities],
  };
};
