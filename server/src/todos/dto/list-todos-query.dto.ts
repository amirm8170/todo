import { Matches, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListTodosQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-20',
    description:
      'Filter by calendar date (YYYY-MM-DD). If omitted, defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date?: string;
}
