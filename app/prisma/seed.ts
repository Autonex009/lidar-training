import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DEMO_PREFIX } from "../src/lib/synthetic/scenes";
import { ensureDemoAssets, demoAssetComplete, writeDemoAsset } from "../src/lib/synthetic/assets-io";

const prisma = new PrismaClient();

async function seedProgram() {
  const data = {
    name: "LiDAR Annotation Foundations",
    description: "Foundational training for 3D LiDAR point-cloud annotation.",
    passingScore: 80,
    navigationProfile: "orbit",
    upAxis: "Z",
    yawConvention: "CCW_ABOUT_UP",
    boxDefinition: "CENTER_DIMS_YAW",
    labelSchema: {
      classes: ["Vehicle", "Pedestrian", "Cyclist", "Pole", "Building", "Vegetation", "Unknown"].map((name) => ({ name })),
    },
    enabledTracks: ["cuboid"],
    certificationRequirements: { requiredTaskCodes: [] as string[] },
    isActive: true,
  };
  return prisma.trainingProgram.upsert({ where: { slug: "foundations" }, create: { slug: "foundations", ...data }, update: data });
}

async function seedLearning(_programId: string) {
  // Stage 2: modules, lessons, quizzes.
}

async function systemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (admin) return admin.id;
  // No admin yet (bootstrap happens via /setup): own demo assets with a non-loginable system user.
  const sys = await prisma.user.upsert({
    where: { email: "system@lidar-portal.local" },
    create: { email: "system@lidar-portal.local", name: "System", passwordHash: `!disabled-${randomBytes(16).toString("hex")}`, role: "REVIEWER" },
    update: {},
  });
  return sys.id;
}

async function seedAssets() {
  // Generate cache files if missing, then register every demo scene as a PointCloudAsset (looked up by cachePath = scene key).
  const metas = ensureDemoAssets();
  for (const m of metas) if (!demoAssetComplete(m.key)) writeDemoAsset(m.key);
  const createdById = await systemUserId();
  for (const m of metas) {
    const data = {
      name: `${DEMO_PREFIX}${m.name}`,
      description: m.description,
      format: "synthetic",
      isSynthetic: true,
      sourcePath: `${m.key}/meta.json`,
      cachePath: m.key,
      pointCount: m.pointCount,
      frameCount: m.frameCount,
      upAxis: "Z",
      metadata: { sceneKey: m.key, label: "DEMO / SYNTHETIC TRAINING DATA" },
    };
    const existing = await prisma.pointCloudAsset.findFirst({ where: { cachePath: m.key, isSynthetic: true } });
    if (existing) await prisma.pointCloudAsset.update({ where: { id: existing.id }, data });
    else await prisma.pointCloudAsset.create({ data: { ...data, createdById } });
  }
  console.log(`Registered ${metas.length} synthetic assets`);
}

async function seedTasks(_programId: string) {
  // Stage 2+: TASK-01 .. TASK-10.
}

async function main() {
  const program = await seedProgram();
  await seedLearning(program.id);
  await seedAssets();
  await seedTasks(program.id);
  console.log(`Seeded program "${program.name}" (${program.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
