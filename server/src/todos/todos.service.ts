import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { CreateTodoDto } from './dto/create-todo.dto';
import type { PublicTodo } from './dto/todo-response';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';
import { todayDateOnly, toDateOnly } from './task-date';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todosRepository: Repository<Todo>,
  ) {}

  async findAll(userId: string, date?: string): Promise<PublicTodo[]> {
    const taskDate = date ?? todayDateOnly();

    // Includes completed todos. TypeORM skips rows with deletedAt set.
    const todos = await this.todosRepository.find({
      where: {
        userId,
        taskDate: Raw((alias) => `DATE(${alias}) = :taskDate`, { taskDate }),
      },
      order: { createdAt: 'DESC' },
    });

    return todos.map((todo) => this.toPublicTodo(todo));
  }

  async findOne(id: string, userId: string): Promise<PublicTodo> {
    return this.toPublicTodo(await this.findOwnedTodo(id, userId));
  }

  async create(userId: string, dto: CreateTodoDto): Promise<PublicTodo> {
    const todo = this.todosRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      completed: false,
      taskDate: dto.taskDate ?? todayDateOnly(),
      userId,
    });

    const saved = await this.todosRepository.save(todo);
    return this.toPublicTodo(saved);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTodoDto,
  ): Promise<PublicTodo> {
    const todo = await this.findOwnedTodo(id, userId);

    // Only copy fields the client actually sent. Object.assign(todo, dto)
    // can overwrite title/description with undefined from the DTO class.
    if (dto.title !== undefined) {
      todo.title = dto.title;
    }
    if (dto.description !== undefined) {
      todo.description = dto.description;
    }
    if (dto.completed !== undefined) {
      todo.completed = dto.completed;
    }
    if (dto.taskDate !== undefined) {
      todo.taskDate = dto.taskDate;
    }

    await this.todosRepository.save(todo);

    return this.toPublicTodo(await this.findOwnedTodo(id, userId));
  }

  async remove(id: string, userId: string): Promise<void> {
    const todo = await this.findOwnedTodo(id, userId);
    await this.todosRepository.softRemove(todo);
  }

  private async findOwnedTodo(id: string, userId: string): Promise<Todo> {
    const todo = await this.todosRepository.findOne({
      where: { id, userId },
    });

    // Missing, owned by someone else, or already soft-deleted.
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    return todo;
  }

  private toPublicTodo(todo: Todo): PublicTodo {
    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      taskDate: toDateOnly(todo.taskDate),
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }
}
