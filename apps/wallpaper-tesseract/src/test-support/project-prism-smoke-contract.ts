export interface ProjectPrismSmokePoint {
  readonly x: number;
  readonly y: number;
}

export interface ProjectPrismSmokeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ProjectPrismSmokeElementSnapshot {
  readonly tag: string;
  readonly className?: string;
  readonly role?: string | null;
  readonly aria?: string | null;
  readonly text?: string;
}

export interface ProjectPrismActorInputHitEvidence {
  readonly actorId: string;
  readonly partId: string;
  readonly graphSplitId?: string;
  readonly graphTabsetId?: string;
  readonly graphContentId?: string;
}

export interface ProjectPrismExpectedTargetEvidence {
  readonly actorId?: string;
  readonly partId?: string;
  readonly graphSplitId?: string;
  readonly graphTabsetId?: string;
  readonly graphContentId?: string;
  readonly domTag?: string;
  readonly domClassIncludes?: string;
  readonly domTextIncludes?: string;
  readonly domAriaIncludes?: string;
  readonly actionResultContains?: Record<string, unknown>;
}

export interface ProjectPrismInteractionEvidence {
  readonly name: string;
  readonly point: ProjectPrismSmokePoint;
  readonly expected: string;
  readonly expectedTarget?: ProjectPrismExpectedTargetEvidence;
  readonly domTop: ProjectPrismSmokeElementSnapshot | null;
  readonly domStack: readonly ProjectPrismSmokeElementSnapshot[];
  readonly actorInputHit: ProjectPrismActorInputHitEvidence | null;
  readonly actionResult: Record<string, unknown>;
  readonly screenshotPath: string;
}

export interface ProjectPrismGraphViewIdentityEvidence {
  readonly typeKey: string;
  readonly instanceId: string;
}

export interface ProjectPrismGraphContentEvidence {
  readonly contentId: string;
  readonly frameId: string;
  readonly tabsetId: string;
  readonly viewActorId: string;
  readonly identity: ProjectPrismGraphViewIdentityEvidence;
  readonly active: boolean;
  readonly interactable: boolean;
}

export interface ProjectPrismGraphTabsetEvidence {
  readonly frameId: string;
  readonly tabsetId: string;
  readonly contentIds: readonly string[];
  readonly activeContentId: string;
}

export interface ProjectPrismGraphSplitEvidence {
  readonly frameId: string;
  readonly splitId: string;
  readonly direction: "horizontal" | "vertical";
}

export interface ProjectPrismGraphFrameEvidence {
  readonly frameId: string;
  readonly kind: "persistent" | "runtime";
  readonly presentation: string;
  readonly visible: boolean;
  readonly tabsetIds: readonly string[];
  readonly splitIds: readonly string[];
}

export interface ProjectPrismGraphSnapshotEvidence {
  readonly revision: number;
  readonly frames: readonly ProjectPrismGraphFrameEvidence[];
  readonly tabsets: readonly ProjectPrismGraphTabsetEvidence[];
  readonly splits: readonly ProjectPrismGraphSplitEvidence[];
  readonly contents: readonly ProjectPrismGraphContentEvidence[];
}

export interface ProjectPrismDomContentEvidence {
  readonly contentId: string;
  readonly parentCount: number;
  readonly parentFrameId?: string;
  readonly parentTabsetId?: string;
  readonly hidden: boolean;
  readonly interactable: boolean;
  readonly rect: ProjectPrismSmokeRect;
}

export interface ProjectPrismDomEvidence {
  readonly contents: readonly ProjectPrismDomContentEvidence[];
}

export interface ProjectPrismPersistenceDescriptorEvidence {
  readonly typeKey: string;
  readonly instanceId: string;
}

export interface ProjectPrismPersistenceEvidence {
  readonly version: number;
  readonly descriptors: readonly ProjectPrismPersistenceDescriptorEvidence[];
  readonly frameIds: readonly string[];
  readonly runtimeOnlyFrameIds: readonly string[];
  readonly containsActorIds: boolean;
  readonly containsDomIds: boolean;
  readonly containsRuntimeFrameIds: boolean;
  readonly containsContentDomIds: boolean;
}

export interface ProjectPrismScenarioEvidence {
  readonly name: string;
  readonly passed: boolean;
  readonly screenshotPaths: readonly string[];
  readonly notes?: string;
}

export interface ProjectPrismSmokeEvidence {
  readonly passed: boolean;
  readonly validationErrors: readonly string[];
  readonly url: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly consoleErrors: readonly string[];
  readonly graph: ProjectPrismGraphSnapshotEvidence;
  readonly dom: ProjectPrismDomEvidence;
  readonly persistence: ProjectPrismPersistenceEvidence;
  readonly scenarios: readonly ProjectPrismScenarioEvidence[];
  readonly interactions: readonly ProjectPrismInteractionEvidence[];
}

const requiredScenarioNames = [
  "boot-baseline",
  "window-menu-open-focus",
  "root-tab-close-reopen",
  "dock-mutation-5b-5c",
  "splitter-resize",
  "scene-fullscreen-restore",
  "persistence-reload",
  "mobile-viewport",
  "render-input-sanity"
] as const;

export function validateProjectPrismSmokeEvidence(evidence: ProjectPrismSmokeEvidence): string[] {
  const errors: string[] = [];
  if (evidence.passed !== true) {
    errors.push("passed must be true");
  }
  if (evidence.validationErrors.length > 0) {
    errors.push(`validationErrors must be empty, got ${evidence.validationErrors.length}`);
  }
  if (!evidence.url) {
    errors.push("url is required");
  }
  if (evidence.viewport.width <= 0 || evidence.viewport.height <= 0) {
    errors.push("viewport width and height must be positive");
  }
  if (evidence.consoleErrors.length > 0) {
    errors.push(`consoleErrors must be empty, got ${evidence.consoleErrors.length}`);
  }
  validateGraphEvidence(evidence.graph, errors);
  validateDomEvidence(evidence.graph, evidence.dom, errors);
  validatePersistenceEvidence(evidence.persistence, errors);
  validateScenarios(evidence.scenarios, errors);
  if (evidence.interactions.length === 0) {
    errors.push("at least one interaction is required");
  }
  for (const interaction of evidence.interactions) {
    validateInteraction(interaction, errors);
  }
  return errors.sort();
}

function validateGraphEvidence(graph: ProjectPrismGraphSnapshotEvidence, errors: string[]): void {
  if (graph.revision <= 0) {
    errors.push("graph revision must be positive");
  }
  if (graph.frames.length === 0) {
    errors.push("graph frames are required");
  }
  if (graph.tabsets.length === 0) {
    errors.push("graph tabsets are required");
  }
  if (graph.contents.length === 0) {
    errors.push("graph contents are required");
  }
  const frameIds = new Set(graph.frames.map((frame) => frame.frameId));
  const tabsetIds = new Set(graph.tabsets.map((tabset) => tabset.tabsetId));
  const splitIds = new Set(graph.splits.map((split) => split.splitId));
  const contentIds = new Set<string>();
  for (const frame of graph.frames) {
    if (!frame.frameId) errors.push("graph frame id is required");
    for (const tabsetId of frame.tabsetIds) {
      if (!tabsetIds.has(tabsetId)) errors.push(`graph frame ${frame.frameId}: unknown tabset ${tabsetId}`);
    }
    for (const splitId of frame.splitIds) {
      if (!splitIds.has(splitId)) errors.push(`graph frame ${frame.frameId}: unknown split ${splitId}`);
    }
  }
  for (const content of graph.contents) {
    if (contentIds.has(content.contentId)) {
      errors.push(`graph content ${content.contentId}: duplicate contentId`);
    }
    contentIds.add(content.contentId);
    if (!frameIds.has(content.frameId)) {
      errors.push(`graph content ${content.contentId}: unknown frame ${content.frameId}`);
    }
    if (!tabsetIds.has(content.tabsetId)) {
      errors.push(`graph content ${content.contentId}: unknown tabset ${content.tabsetId}`);
    }
    if (!content.identity.typeKey || !content.identity.instanceId) {
      errors.push(`graph content ${content.contentId}: identity typeKey and instanceId are required`);
    }
  }
  for (const tabset of graph.tabsets) {
    if (!frameIds.has(tabset.frameId)) {
      errors.push(`graph tabset ${tabset.tabsetId}: unknown frame ${tabset.frameId}`);
    }
    if (!tabset.contentIds.includes(tabset.activeContentId)) {
      errors.push(`graph tabset ${tabset.tabsetId}: activeContentId must be in contentIds`);
    }
    for (const contentId of tabset.contentIds) {
      if (!contentIds.has(contentId)) {
        errors.push(`graph tabset ${tabset.tabsetId}: unknown content ${contentId}`);
      }
    }
  }
}

function validateDomEvidence(
  graph: ProjectPrismGraphSnapshotEvidence,
  dom: ProjectPrismDomEvidence,
  errors: string[]
): void {
  const graphContentsById = new Map(graph.contents.map((content) => [content.contentId, content]));
  const tabsetsById = new Map(graph.tabsets.map((tabset) => [tabset.tabsetId, tabset]));
  const seenDomContentIds = new Set<string>();
  for (const content of dom.contents) {
    if (seenDomContentIds.has(content.contentId)) {
      errors.push(`dom content ${content.contentId}: duplicate content evidence`);
    }
    seenDomContentIds.add(content.contentId);
    const graphContent = graphContentsById.get(content.contentId);
    if (!graphContent) {
      errors.push(`dom content ${content.contentId}: not present in graph`);
      continue;
    }
    if (content.parentCount !== 1) {
      errors.push(`dom content ${content.contentId}: parentCount expected 1, got ${content.parentCount}`);
    }
    if (content.parentFrameId && content.parentFrameId !== graphContent.frameId) {
      errors.push(`dom content ${content.contentId}: parentFrameId expected ${graphContent.frameId}, got ${content.parentFrameId}`);
    }
    if (content.parentTabsetId && content.parentTabsetId !== graphContent.tabsetId) {
      errors.push(`dom content ${content.contentId}: parentTabsetId expected ${graphContent.tabsetId}, got ${content.parentTabsetId}`);
    }
    const tabset = tabsetsById.get(graphContent.tabsetId);
    const active = tabset?.activeContentId === content.contentId;
    if (active && (content.hidden || !content.interactable)) {
      errors.push(`dom content ${content.contentId}: active graph content must be visible and interactable`);
    }
    if (!active && !content.hidden && content.interactable) {
      errors.push(`dom content ${content.contentId}: inactive graph content must not remain visible and interactable`);
    }
    if (active && (content.rect.width <= 0 || content.rect.height <= 0)) {
      errors.push(`dom content ${content.contentId}: active content rect must be measurable`);
    }
  }
  for (const contentId of graphContentsById.keys()) {
    if (!seenDomContentIds.has(contentId)) {
      errors.push(`dom content ${contentId}: missing DOM evidence`);
    }
  }
}

function validatePersistenceEvidence(
  persistence: ProjectPrismPersistenceEvidence,
  errors: string[]
): void {
  if (persistence.version !== 2) {
    errors.push(`persistence version expected 2, got ${persistence.version}`);
  }
  if (persistence.descriptors.length === 0) {
    errors.push("persistence descriptors are required");
  }
  for (const descriptor of persistence.descriptors) {
    if (!descriptor.typeKey || !descriptor.instanceId) {
      errors.push("persistence descriptor typeKey and instanceId are required");
    }
  }
  if (persistence.containsActorIds) {
    errors.push("persistence must not contain actor ids");
  }
  if (persistence.containsDomIds) {
    errors.push("persistence must not contain DOM ids");
  }
  if (persistence.containsRuntimeFrameIds) {
    errors.push("persistence must not contain runtime frame ids");
  }
  if (persistence.containsContentDomIds) {
    errors.push("persistence must not contain content DOM ids");
  }
  if (persistence.runtimeOnlyFrameIds.length > 0) {
    errors.push(`persistence must not include runtime-only frame ids, got ${persistence.runtimeOnlyFrameIds.join(", ")}`);
  }
}

function validateScenarios(
  scenarios: readonly ProjectPrismScenarioEvidence[],
  errors: string[]
): void {
  const scenariosByName = new Map(scenarios.map((scenario) => [scenario.name, scenario]));
  for (const name of requiredScenarioNames) {
    const scenario = scenariosByName.get(name);
    if (!scenario) {
      errors.push(`scenario ${name}: missing`);
      continue;
    }
    if (!scenario.passed) {
      errors.push(`scenario ${name}: passed must be true`);
    }
    if (scenario.screenshotPaths.length === 0) {
      errors.push(`scenario ${name}: at least one screenshotPath is required`);
    }
  }
}

function validateInteraction(interaction: ProjectPrismInteractionEvidence, errors: string[]): void {
  const prefix = `interaction ${interaction.name || "<unnamed>"}`;
  if (!interaction.name) {
    errors.push("interaction name is required");
  }
  if (!Number.isFinite(interaction.point.x) || !Number.isFinite(interaction.point.y)) {
    errors.push(`${prefix}: point must contain finite x/y coordinates`);
  }
  if (!interaction.expected) {
    errors.push(`${prefix}: expected is required`);
  }
  if (!interaction.domTop) {
    errors.push(`${prefix}: domTop is required`);
  }
  if (interaction.domStack.length === 0) {
    errors.push(`${prefix}: domStack is required`);
  }
  if (!interaction.actorInputHit?.actorId || !interaction.actorInputHit.partId) {
    errors.push(`${prefix}: actorInputHit actorId and partId are required`);
  }
  if (Object.keys(interaction.actionResult).length === 0) {
    errors.push(`${prefix}: actionResult is required`);
  }
  if (!interaction.screenshotPath) {
    errors.push(`${prefix}: screenshotPath is required`);
  }
  validateExpectedTarget(interaction, errors);
}

function validateExpectedTarget(interaction: ProjectPrismInteractionEvidence, errors: string[]): void {
  const expectedTarget = interaction.expectedTarget;
  if (!expectedTarget) {
    return;
  }
  const prefix = `interaction ${interaction.name || "<unnamed>"}`;
  if (expectedTarget.actorId && interaction.actorInputHit?.actorId !== expectedTarget.actorId) {
    errors.push(`${prefix}: actorInputHit actorId expected ${expectedTarget.actorId}, got ${interaction.actorInputHit?.actorId ?? "<none>"}`);
  }
  if (expectedTarget.partId && interaction.actorInputHit?.partId !== expectedTarget.partId) {
    errors.push(`${prefix}: actorInputHit partId expected ${expectedTarget.partId}, got ${interaction.actorInputHit?.partId ?? "<none>"}`);
  }
  if (expectedTarget.graphSplitId && interaction.actorInputHit?.graphSplitId !== expectedTarget.graphSplitId) {
    errors.push(`${prefix}: actorInputHit graphSplitId expected ${expectedTarget.graphSplitId}, got ${interaction.actorInputHit?.graphSplitId ?? "<none>"}`);
  }
  if (expectedTarget.graphTabsetId && interaction.actorInputHit?.graphTabsetId !== expectedTarget.graphTabsetId) {
    errors.push(`${prefix}: actorInputHit graphTabsetId expected ${expectedTarget.graphTabsetId}, got ${interaction.actorInputHit?.graphTabsetId ?? "<none>"}`);
  }
  if (expectedTarget.graphContentId && interaction.actorInputHit?.graphContentId !== expectedTarget.graphContentId) {
    errors.push(`${prefix}: actorInputHit graphContentId expected ${expectedTarget.graphContentId}, got ${interaction.actorInputHit?.graphContentId ?? "<none>"}`);
  }
  if (expectedTarget.domTag && interaction.domTop?.tag.toLowerCase() !== expectedTarget.domTag.toLowerCase()) {
    errors.push(`${prefix}: domTop tag expected ${expectedTarget.domTag}, got ${interaction.domTop?.tag ?? "<none>"}`);
  }
  if (expectedTarget.domClassIncludes && !interaction.domTop?.className?.includes(expectedTarget.domClassIncludes)) {
    errors.push(`${prefix}: domTop className must include ${expectedTarget.domClassIncludes}`);
  }
  if (expectedTarget.domTextIncludes && !interaction.domTop?.text?.includes(expectedTarget.domTextIncludes)) {
    errors.push(`${prefix}: domTop text must include ${expectedTarget.domTextIncludes}`);
  }
  if (expectedTarget.domAriaIncludes && !interaction.domTop?.aria?.includes(expectedTarget.domAriaIncludes)) {
    errors.push(`${prefix}: domTop aria must include ${expectedTarget.domAriaIncludes}`);
  }
  for (const [key, expectedValue] of Object.entries(expectedTarget.actionResultContains ?? {})) {
    const actualValue = interaction.actionResult[key];
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      errors.push(`${prefix}: actionResult.${key} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
    }
  }
}
