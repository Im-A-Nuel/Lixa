const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      fileName: true,
      fileHash: true,
      ipfsCid: true,
      creator: true,
      createdAt: true,
      status: true,
    }
  });

  console.log('Total assets in database:', assets.length);
  console.log('\nAssets:');
  assets.forEach((asset, idx) => {
    console.log(`\n${idx + 1}. ${asset.fileName}`);
    console.log('   Hash:', asset.fileHash);
    console.log('   CID:', asset.ipfsCid);
    console.log('   Creator:', asset.creator);
    console.log('   Created:', asset.createdAt);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
