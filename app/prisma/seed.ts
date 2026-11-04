import { PrismaClient } from "@prisma/client";

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

async function seedAssets() {
  // Stage 2+: deterministic synthetic point-cloud assets.
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
