import { KNOWN_LOCALES as SHARED_KNOWN_LOCALES } from '../supportedLanguages';

/**
 * Groups prompt script files by base name
 *
 * Convention:
 *   - A trailing `_<CODE>` (case-insensitive) is treated as a locale
 *     ONLY when CODE is a known language code (see KNOWN_LOCALES).
 *   - Everything else is a bare group whose locale is "unspecified".
 *
 * This means `pListMccTest2` and `pListMccTest2JE` are two distinct groups
 * (`je` is not a locale), while `customFrench.js` is a single bare group
 * and never gets merged with `customFrench_EN.js` (different stems).
 */

/**
 * Language codes supported by the app. Re-exported from the shared
 * {@link ../supportedLanguages} module so there is a single source of truth.
 */
export const KNOWN_LOCALES: ReadonlySet<string> = SHARED_KNOWN_LOCALES;

/** Locale code meaning "we could not determine the language". */
export const UNSPECIFIED_LOCALE = 'unspecified';

const LOCALE_SUFFIX_RE = /_([A-Za-z]{2,3})$/;

export interface ParsedFileName {
  stem: string;
  locale: string | null; // lowercased locale code
}

export function parseLocale(fileNameNoExt: string): ParsedFileName {
  const match = fileNameNoExt.match(LOCALE_SUFFIX_RE);
  if (match) {
    const code = match[1].toLowerCase();
    if (KNOWN_LOCALES.has(code)) {
      return { stem: fileNameNoExt.slice(0, match.index), locale: code };
    }
  }
  return { stem: fileNameNoExt, locale: null };
}

export interface GroupLocale {
  /** Lowercased language code, or {@link UNSPECIFIED_LOCALE}. */
  code: string;
  path: string;
}

export interface PromptFileGroup {
  /** Stable id: `<directory>/<stem>` with forward slashes. */
  id: string;
  /** Directory portion (forward slashes), no trailing slash. Empty for root. */
  directory: string;
  /** Filename stem shared by all variants. */
  stem: string;
  /** Human-readable label (the stem). */
  displayName: string;
  /** Available variants, sorted by locale code. */
  locales: GroupLocale[];
  /** Path of the English / base file if one exists in the group. */
  englishBasePath?: string;
  /** Group has exactly one locale variant — nothing to switch to. */
  isSingleLocale: boolean;
  /** Group has no recognizable locale variants at all.  */
  isAmbiguous: boolean;
}

interface RawEntry {
  path: string;
  directory: string;
  fileName: string;
  parsed: ParsedFileName;
}

function splitPath(relPath: string): { dir: string; base: string } {
  const norm = relPath.replace(/\\/g, '/');
  const slashIdx = norm.lastIndexOf('/');
  if (slashIdx === -1) return { dir: '', base: norm };
  return { dir: norm.slice(0, slashIdx), base: norm.slice(slashIdx + 1) };
}

function stripExt(fileName: string): string {
  return fileName.replace(/\.js$/i, '');
}

/**
 * Build prompt file groups from a flat list of relative paths
 *
 * Rules for assigning the base/English file:
 *   - A file whose parsed locale is null is the English base of its stem
 *     ONLY if at least one sibling of the same stem has a recognized locale.
 *     Otherwise the whole filename is the stem and the group is ambiguous.
 */
export function buildGroups(files: string[]): PromptFileGroup[] {
  const entries: RawEntry[] = files.map((path) => {
    const { dir, base } = splitPath(path);
    return {
      path,
      directory: dir,
      fileName: base,
      parsed: parseLocale(stripExt(base)),
    };
  });

  const byGroupId = new Map<string, RawEntry[]>();
  for (const entry of entries) {
    const groupId = entry.directory
      ? `${entry.directory}/${entry.parsed.stem}`
      : entry.parsed.stem;
    const arr = byGroupId.get(groupId) ?? [];
    arr.push(entry);
    byGroupId.set(groupId, arr);
  }

  const groups: PromptFileGroup[] = [];
  for (const [groupId, groupEntries] of byGroupId) {
    const hasLocalizedSibling = groupEntries.some((e) => e.parsed.locale !== null);

    const locales: GroupLocale[] = [];
    let englishBasePath: string | undefined;

    for (const entry of groupEntries) {
      if (entry.parsed.locale) {
        locales.push({ code: entry.parsed.locale, path: entry.path });
      } else if (hasLocalizedSibling) {
        locales.push({ code: 'en', path: entry.path });
        englishBasePath = entry.path;
      } else {
        locales.push({ code: UNSPECIFIED_LOCALE, path: entry.path });
      }
    }

    locales.sort((a, b) => a.code.localeCompare(b.code));

    groups.push({
      id: groupId,
      directory: groupEntries[0].directory,
      stem: groupEntries[0].parsed.stem,
      displayName: groupEntries[0].parsed.stem,
      locales,
      englishBasePath,
      isSingleLocale: locales.length === 1,
      isAmbiguous: !hasLocalizedSibling,
    });
  }

  groups.sort((a, b) => {
    if (a.directory !== b.directory) return a.directory.localeCompare(b.directory);
    return a.stem.localeCompare(b.stem);
  });

  return groups;
}

/**
 * Find the group that owns the given script path, if any.
 */
function normPath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function findGroupForPath(groups: PromptFileGroup[], scriptPath: string): PromptFileGroup | undefined {
  const norm = normPath(scriptPath);
  return groups.find((g) => g.locales.some((l) => normPath(l.path) === norm));
}

export interface LocalizedPathResolution {
  newPath: string;
  changed: boolean;
  groupHasTargetLang: boolean;
  groupHasEnglishBase: boolean;
  isFallbackToEn: boolean;
  currentLocale: string;
  group?: PromptFileGroup;
}

/**
 * Resolve the best script path for a target language within a group.
 *
 * Behavior:
 *   - If the group has the target language → return that path.
 *   - Else if the group has an English base → return the English path
 *     (caller decides whether to apply it silently or prompt).
 *   - Else (single-locale or ambiguous) → return the input unchanged.
 */
export function resolveLocalizedPath(
  groups: PromptFileGroup[],
  currentPath: string,
  targetLang: string,
): LocalizedPathResolution {
  const group = findGroupForPath(groups, currentPath);
  const norm = normPath(currentPath);
  const currentLocaleEntry = group?.locales.find((l) => normPath(l.path) === norm);
  const currentLocale = currentLocaleEntry?.code ?? UNSPECIFIED_LOCALE;

  const base: LocalizedPathResolution = {
    newPath: currentPath,
    changed: false,
    groupHasTargetLang: false,
    groupHasEnglishBase: !!group?.englishBasePath,
    isFallbackToEn: false,
    currentLocale,
    group,
  };

  if (!group) return base;

  const target = targetLang.toLowerCase();
  base.groupHasTargetLang = group.locales.some((l) => l.code === target);

  if (base.groupHasTargetLang) {
    const match = group.locales.find((l) => l.code === target)!;
    if (normPath(match.path) !== norm) {
      return { ...base, newPath: match.path, changed: true };
    }
    return base;
  }

  // No variant for the target language.
  if (group.englishBasePath && target !== 'en') {
    return {
      ...base,
      newPath: group.englishBasePath,
      isFallbackToEn: true,
      changed: normPath(group.englishBasePath) !== norm,
    };
  }

  return base;
}
