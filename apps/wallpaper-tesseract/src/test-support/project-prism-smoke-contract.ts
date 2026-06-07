export interface ProjectPrismSmokePoint {
  readonly x: number;
  readonly y: number;
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
}

export interface ProjectPrismExpectedTargetEvidence {
  readonly actorId?: string;
  readonly partId?: string;
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

export interface ProjectPrismSmokeEvidence {
  readonly url: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly consoleErrors: readonly string[];
  readonly interactions: readonly ProjectPrismInteractionEvidence[];
}

export function validateProjectPrismSmokeEvidence(evidence: ProjectPrismSmokeEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.url) {
    errors.push("url is required");
  }
  if (evidence.viewport.width <= 0 || evidence.viewport.height <= 0) {
    errors.push("viewport width and height must be positive");
  }
  if (evidence.consoleErrors.length > 0) {
    errors.push(`consoleErrors must be empty, got ${evidence.consoleErrors.length}`);
  }
  if (evidence.interactions.length === 0) {
    errors.push("at least one interaction is required");
  }
  for (const interaction of evidence.interactions) {
    validateInteraction(interaction, errors);
  }
  return errors.sort();
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
