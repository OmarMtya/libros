import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { BookResult, BooksService } from './books.service';

@Controller('v1/books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get('search')
  async search(@Query('q') q: string | undefined, @Query('limit') limit?: string): Promise<{ results: BookResult[] }> {
    if (!q || !q.trim()) throw new BadRequestException('Query parameter "q" is required.');
    const parsedLimit = limit ? Number(limit) : 8;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) throw new BadRequestException('Limit must be an integer between 1 and 20.');
    const results = await this.books.search(q, parsedLimit);
    return { results };
  }
}
