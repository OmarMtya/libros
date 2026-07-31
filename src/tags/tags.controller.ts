import { Controller, Get } from '@nestjs/common';
import { TAG_TAXONOMY_VERSION } from '../profile/catalog';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/tags')
export class TagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const tags = await this.prisma.tagVersion.findMany({
      where: { taxonomicVersion: TAG_TAXONOMY_VERSION, status: 'active' },
      select: { tagKey: true, name: true, tagType: true },
      orderBy: [{ tagType: 'asc' }, { name: 'asc' }],
    });
    return { tags };
  }
}
