/**
 * TypeDoc option declarations for the llms.txt plugin
 *
 * @packageDocumentation
 */

import { type Application, ParameterType } from 'typedoc';

/**
 * Declaration reference configuration for API links
 */
export interface LlmsTxtDeclaration {
  /**
   * Optional description text
   */
  description?: string;

  /**
   * Display label for the link
   */
  label: string;

  /**
   * TypeDoc declaration reference (e.g., 'myproject!', 'myproject!myFunction')
   */
  ref: string;
}

/**
 * Header configuration for the llms.txt file
 */
export interface LlmsTxtHeader {
  /**
   * Project description blockquote (defaults to package.json description)
   */
  description?: string;

  /**
   * Feature bullet points
   */
  features?: string[];

  /**
   * Project name (defaults to TypeDoc's name option)
   */
  name?: string;
}

/**
 * Section configuration for mapping frontmatter categories
 */
export interface LlmsTxtSectionConfig {
  /**
   * Display name for this section in llms.txt
   */
  displayName: string;

  /**
   * Sort order (lower = earlier)
   */
  order: number;
}

/**
 * Registers the plugin's TypeDoc options
 *
 * @function
 * @param app - The TypeDoc application instance
 */
export const declareOptions = (app: Application): void => {
  app.options.addDeclaration({
    defaultValue: true,
    help: '[llms-txt] Enable or disable llms.txt generation',
    name: 'llmsTxt',
    type: ParameterType.Boolean,
  });

  app.options.addDeclaration({
    defaultValue: 'llms.txt',
    help: '[llms-txt] Output filename',
    name: 'llmsTxtFilename',
    type: ParameterType.String,
  });

  app.options.addDeclaration({
    defaultValue: {},
    help: '[llms-txt] Header configuration { name?, description?, features?: string[] }',
    name: 'llmsTxtHeader',
    type: ParameterType.Mixed,
  });

  app.options.addDeclaration({
    defaultValue: {},
    help: '[llms-txt] Section configuration mapping categories to display names and order',
    name: 'llmsTxtSections',
    type: ParameterType.Mixed,
  });

  app.options.addDeclaration({
    defaultValue: [],
    help: '[llms-txt] Declaration references for API section',
    name: 'llmsTxtDeclarations',
    type: ParameterType.Mixed,
  });

  app.options.addDeclaration({
    defaultValue: '',
    help: '[llms-txt] Code examples content for quick reference section',
    name: 'llmsTxtQuickReference',
    type: ParameterType.String,
  });

  app.options.addDeclaration({
    help: '[llms-txt] Path to custom template file',
    name: 'llmsTxtTemplate',
    type: ParameterType.Path,
  });
};

/**
 * Gets the configured options with defaults applied
 *
 * @function
 * @param app - The TypeDoc application instance
 */
export const getOptions = (
  app: Application,
): {
  declarations: LlmsTxtDeclaration[];
  enabled: boolean;
  filename: string;
  header: LlmsTxtHeader;
  quickReference: string;
  sections: Record<string, LlmsTxtSectionConfig>;
  template: string | undefined;
} => {
  return {
    declarations:
      (app.options.getValue('llmsTxtDeclarations') as LlmsTxtDeclaration[]) ??
      [],
    enabled: app.options.getValue('llmsTxt') as boolean,
    filename: app.options.getValue('llmsTxtFilename') as string,
    header: (app.options.getValue('llmsTxtHeader') as LlmsTxtHeader) ?? {},
    quickReference: app.options.getValue('llmsTxtQuickReference') as string,
    sections:
      (app.options.getValue('llmsTxtSections') as Record<
        string,
        LlmsTxtSectionConfig
      >) ?? {},
    template: app.options.getValue('llmsTxtTemplate') as string | undefined,
  };
};
