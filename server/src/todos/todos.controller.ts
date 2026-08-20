import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTodoDto } from './dto/create-todo.dto';
import { ListTodosQueryDto } from './dto/list-todos-query.dto';
import { PublicTodo } from './dto/todo-response';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodosService } from './todos.service';

@ApiTags('Todos')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  @ApiOperation({
    summary: 'List todos',
    description:
      "Returns the current user's todos for one calendar date, including completed items. Pass `date=YYYY-MM-DD`. If `date` is omitted, defaults to today. Soft-deleted items are omitted.",
  })
  @ApiOkResponse({ type: PublicTodo, isArray: true })
  findAll(
    @CurrentUser() user: { userId: string },
    @Query() query: ListTodosQueryDto,
  ): Promise<PublicTodo[]> {
    return this.todosService.findAll(user.userId, query.date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one todo' })
  @ApiOkResponse({ type: PublicTodo })
  @ApiNotFoundResponse({ description: 'Todo not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<PublicTodo> {
    return this.todosService.findOne(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a todo' })
  @ApiCreatedResponse({ type: PublicTodo })
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateTodoDto,
  ): Promise<PublicTodo> {
    return this.todosService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a todo',
    description:
      'Updates title, description, completed, and/or taskDate. Returns the full todo object.',
  })
  @ApiOkResponse({ type: PublicTodo })
  @ApiNotFoundResponse({ description: 'Todo not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateTodoDto,
  ): Promise<PublicTodo> {
    return this.todosService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete a todo',
    description:
      'Sets deletedAt. The row stays in the database and is hidden from GET endpoints.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Todo not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    return this.todosService.remove(id, user.userId);
  }
}
