/**
 * Core llms.txt content generation logic
 *
 * @packageDocumentation
 */

import type {
  Application,
  DeclarationReflection,
  ProjectReflection,
  Router,
} from 'typedoc';

import fs from 'node:fs';
import path from 'node:path';
import { ReflectionKind } from 'typedoc';

import type {
  LlmsTxtDeclaration,
  LlmsTxtHeader,
  LlmsTxtSectionConfig,
} from './options.js';

/**
 * Joins a base URL with a path, avoiding double slashes
 *
 * @function
 * @param baseUrl - The base URL (e.g., 'https://example.com')
 * @param urlPath - The path to append (may or may not start with '/')
 * @returns The joined URL
 */
const joinUrl = (baseUrl: string, urlPath: string): string => {
  if (!baseUrl) {
    return urlPath;
  }
  // Remove trailing slash from base and leading slash from path
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  return `${normalizedBase}/${normalizedPath}`;
};

/**
 * Document info extracted from markdown frontmatter
 */
export interface DocumentInfo {
  category: string;
  path: string;
  title: string;
}

/**
 * All content needed to render llms.txt
 */
export interface LlmsTxtContent {
  declarations: ResolvedDeclaration[];
  header: {
    description: string;
    features: string[];
    name: string;
  };
  quickReference: string;
  sections: Section[];
}

/**
 * Resolved declaration with URL
 */
export interface ResolvedDeclaration {
  description?: string;
  label: string;
  url: string;
}

/**
 * Section with its documents
 */
export interface Section {
  displayName: string;
  documents: DocumentInfo[];
  name: string;
  order: number;
}

/**
 * Strips YAML string quotes from a value
 *
 * YAML allows strings to be quoted with single or double quotes to escape
 * special characters. This function removes those quotes to get the actual
 * string value.
 *
 * @function
 * @param value - Raw YAML string value (may include quotes)
 * @returns Unquoted string value
 */
export const stripYamlQuotes = (value: string): string => {
  const trimmed = value.trim();

  // Single-quoted string: 'value'
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  // Double-quoted string: "value"
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

/**
 * Extracts YAML frontmatter from markdown content
 *
 * @function
 * @param content - Markdown file content
 * @returns Frontmatter object or null if not found
 */
export const extractFrontmatter = (
  content: string,
): null | { category?: string; title?: string } => {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = match?.[1];
  if (!frontmatter) {
    return null;
  }

  const result: { category?: string; title?: string } = {};

  const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1];
  if (title) {
    result.title = stripYamlQuotes(title);
  }

  const category = frontmatter.match(/^category:\s*(.+)$/m)?.[1];
  if (category) {
    result.category = stripYamlQuotes(category);
  }

  return result;
};

/**
 * Converts a document title to TypeDoc's URL path format
 *
 * TypeDoc converts titles by:
 *
 * - `@` → `-I_`
 * - `/` → `_`
 * - `&` → `___`
 * - ` ` → `_`
 *
 * @function
 * @param title - Document title
 * @returns URL path segment
 */
export const titleToUrlPath = (title: string): string => {
  return title
    .replace(/@/g, '-I_')
    .replace(/\//g, '_')
    .replace(/ & /g, '___')
    .replace(/ /g, '_');
};

/**
 * Discovers sections from project document reflections using the router for
 * URLs
 *
 * This is the preferred method as it uses TypeDoc's parsed document reflections
 * and the router for correct URL generation regardless of router
 * configuration.
 *
 * @function
 * @param project - TypeDoc project reflection
 * @param router - TypeDoc router for URL generation
 * @param sectionConfig - User-provided section configuration
 * @param baseUrl - Base URL for links (prepended to router-generated paths)
 * @returns Array of sections with their documents
 */
export const discoverSectionsFromProject = (
  project: ProjectReflection,
  router: Router,
  sectionConfig: Record<string, LlmsTxtSectionConfig>,
  baseUrl: string,
): Section[] => {
  const sectionMap = new Map<string, DocumentInfo[]>();

  // Collect documents from the project and all its children recursively
  const collectDocuments = (
    reflection: DeclarationReflection | ProjectReflection,
  ) => {
    if (reflection.documents) {
      for (const doc of reflection.documents) {
        // Get the category from the document's frontmatter
        // TypeDoc stores the parsed frontmatter in doc.frontmatter
        let category: string | undefined;

        // Check if document has a category in its frontmatter
        if (
          doc.frontmatter &&
          typeof doc.frontmatter.category === 'string' &&
          doc.frontmatter.category
        ) {
          category = doc.frontmatter.category;
        }

        // Fallback: check for @category block tag in the document's comment
        if (!category && doc.comment?.blockTags) {
          const categoryTag = doc.comment.blockTags.find(
            (tag) => tag.tag === '@category',
          );
          if (categoryTag) {
            category = categoryTag.content
              .map((part) => part.text)
              .join('')
              .trim();
          }
        }

        // Fallback: use a default category for documents without one
        if (!category) {
          category = 'Documentation';
        }

        if (!sectionMap.has(category)) {
          sectionMap.set(category, []);
        }

        // Use the router to get the correct URL
        const urlPath = router.getFullUrl(doc);
        sectionMap.get(category)!.push({
          category,
          path: joinUrl(baseUrl, urlPath),
          title: doc.name,
        });
      }
    }

    // Recursively check children (for modules that may have their own documents)
    if ('children' in reflection && reflection.children) {
      for (const child of reflection.children) {
        collectDocuments(child);
      }
    }
  };

  collectDocuments(project);

  // Convert to sections array with ordering
  const sections: Section[] = [];
  let autoOrder = 1000; // High default for unconfigured sections

  for (const [category, documents] of sectionMap) {
    const config = sectionConfig[category];
    sections.push({
      displayName: config?.displayName ?? category,
      documents: documents.sort((a, b) => a.title.localeCompare(b.title)),
      name: category,
      order: config?.order ?? autoOrder++,
    });
  }

  // Sort by order
  return sections.sort((a, b) => a.order - b.order);
};

/**
 * Discovers sections from project documents by reading files from disk
 *
 * @deprecated Use {@link discoverSectionsFromProject} instead, which uses
 *   TypeDoc's router for correct URL generation.
 * @function
 * @param projectDocuments - Paths to project document files
 * @param sectionConfig - User-provided section configuration
 * @param baseUrl - Base URL for links
 * @returns Array of sections with their documents
 */
export const discoverSections = (
  projectDocuments: string[],
  sectionConfig: Record<string, LlmsTxtSectionConfig>,
  baseUrl: string,
): Section[] => {
  const sectionMap = new Map<string, DocumentInfo[]>();

  for (const docPath of projectDocuments) {
    if (!docPath.endsWith('.md')) {
      continue;
    }

    try {
      const content = fs.readFileSync(docPath, 'utf8');
      const frontmatter = extractFrontmatter(content);

      if (!frontmatter?.title || !frontmatter?.category) {
        continue;
      }

      // Skip aggregation files (like all.md that includes others)
      const basename = path.basename(docPath);
      if (basename === 'all.md') {
        continue;
      }

      const category = frontmatter.category;
      if (!sectionMap.has(category)) {
        sectionMap.set(category, []);
      }

      const urlPath = `documents/${titleToUrlPath(frontmatter.title)}/`;
      sectionMap.get(category)!.push({
        category,
        path: `${baseUrl}/${urlPath}`,
        title: frontmatter.title,
      });
    } catch {
      // Skip files that can't be read
    }
  }

  // Convert to sections array with ordering
  const sections: Section[] = [];
  let autoOrder = 1000; // High default for unconfigured sections

  for (const [category, documents] of sectionMap) {
    const config = sectionConfig[category];
    sections.push({
      displayName: config?.displayName ?? category,
      documents: documents.sort((a, b) => a.title.localeCompare(b.title)),
      name: category,
      order: config?.order ?? autoOrder++,
    });
  }

  // Sort by order
  return sections.sort((a, b) => a.order - b.order);
};

/**
 * Gets a human-readable description for a reflection based on its kind
 *
 * @function
 * @param reflection - The reflection to describe
 * @returns Human-readable kind description
 */
const getKindDescription = (reflection: DeclarationReflection): string => {
  switch (reflection.kind) {
    case ReflectionKind.Accessor:
      return 'accessor';
    case ReflectionKind.Class:
      return 'class';
    case ReflectionKind.Enum:
      return 'enum';
    case ReflectionKind.Function:
      return 'function';
    case ReflectionKind.Interface:
      return 'interface';
    case ReflectionKind.Module:
      return 'module';
    case ReflectionKind.Namespace:
      return 'namespace';
    case ReflectionKind.TypeAlias:
      return 'type alias';
    case ReflectionKind.Variable:
      return 'variable';
    default:
      return 'declaration';
  }
};

/**
 * Auto-generates declarations from project children using the router for URLs
 *
 * This function generates API declarations for all top-level children of the
 * project. These may be modules (for multi-entry-point projects) or direct
 * exports (for single-entry-point projects).
 *
 * @function
 * @param project - TypeDoc project reflection
 * @param router - TypeDoc router for URL generation
 * @param baseUrl - Base URL for links (prepended to router-generated paths)
 * @returns Array of resolved declarations
 */
export const autoGenerateDeclarations = (
  project: ProjectReflection,
  router: Router,
  baseUrl: string,
): ResolvedDeclaration[] => {
  const declarations: ResolvedDeclaration[] = [];

  if (project.children) {
    for (const child of project.children) {
      // Use the router to get the correct URL for this reflection
      const urlPath = router.getFullUrl(child);
      const kindDesc = getKindDescription(child);

      declarations.push({
        description: `${child.name} ${kindDesc}`,
        label: child.name,
        url: joinUrl(baseUrl, urlPath),
      });
    }
  }

  return declarations;
};

/**
 * Resolves declaration references to URLs using the router
 *
 * Declaration references use TypeDoc's format:
 *
 * - `moduleName!` - Reference to a module/entry point
 * - `moduleName!symbolName` - Reference to a symbol within a module
 * - `moduleName!symbolName.member` - Reference to a nested member
 *
 * @function
 * @param declarations - User-provided declaration configs
 * @param project - TypeDoc project reflection
 * @param router - TypeDoc router for URL generation
 * @param app - TypeDoc application (for logging)
 * @param baseUrl - Base URL for links (prepended to router-generated paths)
 * @returns Array of resolved declarations
 */
export const resolveDeclarations = (
  declarations: LlmsTxtDeclaration[],
  project: ProjectReflection,
  router: Router,
  app: Application,
  baseUrl: string,
): ResolvedDeclaration[] => {
  const resolved: ResolvedDeclaration[] = [];

  for (const decl of declarations) {
    // Parse the declaration reference
    // Format: "module!" or "module!symbol" or "module!symbol.member"
    const ref = decl.ref;

    // Try to resolve the reference to a reflection
    let reflection: DeclarationReflection | undefined;

    if (ref.endsWith('!')) {
      // Module/entry point reference (e.g., "bupkis!")
      const moduleName = ref.slice(0, -1);
      reflection = project.children?.find((c) => c.name === moduleName);
    } else if (ref.includes('!')) {
      // Symbol reference (e.g., "bupkis!expect" or "bupkis!MyClass.method")
      const [moduleName, symbolPath] = ref.split('!');
      const moduleReflection = project.children?.find(
        (c) => c.name === moduleName,
      );

      if (moduleReflection) {
        // Navigate to the symbol through the path
        const parts = symbolPath.split('.');
        let current: DeclarationReflection | undefined = moduleReflection;

        for (const part of parts) {
          current = current?.children?.find((c) => c.name === part);
          if (!current) {
            break;
          }
        }

        reflection = current;
      }
    }

    if (reflection) {
      // Use the router to get the correct URL
      const urlPath = router.getFullUrl(reflection);
      resolved.push({
        description: decl.description,
        label: decl.label,
        url: joinUrl(baseUrl, urlPath),
      });
    } else {
      // Fallback: log warning and skip
      app.logger.warn(
        `[llms-txt] Could not resolve declaration reference: ${ref}`,
      );
    }
  }

  return resolved;
};

/**
 * Gets the project name with fallback
 *
 * @function
 * @param app - TypeDoc application
 * @param headerConfig - User header configuration
 * @returns Project name
 */
export const getProjectName = (
  app: Application,
  headerConfig: LlmsTxtHeader,
): string => {
  if (headerConfig.name) {
    return headerConfig.name;
  }
  return app.options.getValue('name');
};

/**
 * Gets the project description with fallback to package.json
 *
 * @function
 * @param app - TypeDoc application
 * @param headerConfig - User header configuration
 * @returns Project description or empty string
 */
export const getProjectDescription = (
  app: Application,
  headerConfig: LlmsTxtHeader,
): string => {
  if (headerConfig.description) {
    return headerConfig.description;
  }

  // Try to read from package.json
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const { parse } = JSON;
    const packageJson = parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      description?: string;
    };
    return packageJson.description ?? '';
  } catch {
    return '';
  }
};

/**
 * Renders the llms.txt content to a string
 *
 * @function
 * @param content - The content to render
 * @returns Rendered llms.txt string
 */
export const renderLlmsTxt = (content: LlmsTxtContent): string => {
  const lines: string[] = [];

  // Header
  lines.push(`# ${content.header.name}`);
  lines.push('');

  if (content.header.description) {
    lines.push(`> ${content.header.description}`);
    lines.push('');
  }

  if (content.header.features.length > 0) {
    for (const feature of content.header.features) {
      lines.push(`- ${feature}`);
    }
    lines.push('');
  }

  // Sections
  for (const section of content.sections) {
    lines.push(`## ${section.displayName}`);
    for (const doc of section.documents) {
      lines.push(`- [${doc.title}](${doc.path})`);
    }
    lines.push('');
  }

  // Declarations (API section)
  if (content.declarations.length > 0) {
    lines.push('## API');
    for (const decl of content.declarations) {
      if (decl.description) {
        lines.push(`- [${decl.label}](${decl.url}): ${decl.description}`);
      } else {
        lines.push(`- [${decl.label}](${decl.url})`);
      }
    }
    lines.push('');
  }

  // Quick Reference
  if (content.quickReference) {
    lines.push('## Quick Reference');
    lines.push('');
    lines.push('```javascript');
    lines.push(content.quickReference.trim());
    lines.push('```');
  }

  return lines.join('\n');
};

/**
 * Renders a specific section to markdown
 *
 * @function
 * @param section - The section to render
 * @returns Rendered section string
 */
export const renderSection = (section: Section): string => {
  const lines: string[] = [];
  lines.push(`## ${section.displayName}`);
  for (const doc of section.documents) {
    lines.push(`- [${doc.title}](${doc.path})`);
  }
  return lines.join('\n');
};

/**
 * Renders the header to markdown
 *
 * @function
 * @param header - Header content
 * @returns Rendered header string
 */
export const renderHeader = (header: LlmsTxtContent['header']): string => {
  const lines: string[] = [];
  lines.push(`# ${header.name}`);
  lines.push('');

  if (header.description) {
    lines.push(`> ${header.description}`);
    lines.push('');
  }

  if (header.features.length > 0) {
    for (const feature of header.features) {
      lines.push(`- ${feature}`);
    }
  }

  return lines.join('\n');
};

/**
 * Renders declarations to markdown
 *
 * @function
 * @param declarations - Resolved declarations
 * @returns Rendered declarations string
 */
export const renderDeclarations = (
  declarations: ResolvedDeclaration[],
): string => {
  if (declarations.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## API');
  for (const decl of declarations) {
    if (decl.description) {
      lines.push(`- [${decl.label}](${decl.url}): ${decl.description}`);
    } else {
      lines.push(`- [${decl.label}](${decl.url})`);
    }
  }
  return lines.join('\n');
};

/**
 * Renders quick reference to markdown
 *
 * @function
 * @param quickReference - Quick reference content
 * @returns Rendered quick reference string
 */
export const renderQuickReference = (quickReference: string): string => {
  if (!quickReference) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Quick Reference');
  lines.push('');
  lines.push('```javascript');
  lines.push(quickReference.trim());
  lines.push('```');
  return lines.join('\n');
};
