import { ApiProperty } from '@nestjs/swagger';

export class PublicTodo {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id: string;

  @ApiProperty({ example: 'Buy milk' })
  title: string;

  @ApiProperty({
    example: '2 liters, low fat',
    nullable: true,
    type: String,
  })
  description: string | null;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({
    example: '2026-08-20',
    description: 'Calendar date this todo belongs to (YYYY-MM-DD).',
  })
  taskDate: string;

  @ApiProperty({ example: '2026-08-20T10:15:30.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-20T10:15:30.000Z' })
  updatedAt: Date;
}
