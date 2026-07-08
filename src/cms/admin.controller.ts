import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { UploadedImage } from './posts.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { SafeUser } from '../auth/auth.service'
import { CategoriesService } from './categories.service'
import { TagsService } from './tags.service'
import { PostsService } from './posts.service'
import { ViewsService } from './views.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { UpsertTagDto } from './dto/tag.dto'
import { CreatePostDto, UpdatePostDto } from './dto/post.dto'

@Controller('admin/categories')
@UseGuards(JwtAuthGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list()
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id)
  }
}

@Controller('admin/tags')
@UseGuards(JwtAuthGuard)
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list() {
    return this.tags.list()
  }

  @Post()
  create(@Body() dto: UpsertTagDto) {
    return this.tags.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertTagDto) {
    return this.tags.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tags.remove(id)
  }
}

@Controller('admin/posts')
@UseGuards(JwtAuthGuard)
export class AdminPostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly views: ViewsService,
  ) {}

  @Get()
  list() {
    return this.posts.listAdmin()
  }

  @Get('analytics/overview')
  overview() {
    return this.views.overview()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.posts.getAdmin(id)
  }

  @Get(':id/analytics')
  analytics(@Param('id') id: string) {
    return this.views.postAnalytics(id)
  }

  @Post()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: SafeUser) {
    return this.posts.create(user.id, dto.title)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(id, dto)
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.posts.publish(id)
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.posts.unpublish(id)
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.posts.archive(id)
  }

  @Post(':id/unarchive')
  unarchive(@Param('id') id: string) {
    return this.posts.unarchive(id)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.posts.remove(id)
  }

  // ── capa (R2) ──
  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  setCover(@Param('id') id: string, @UploadedFile() file: UploadedImage) {
    return this.posts.setCover(id, file)
  }

  @Delete(':id/cover')
  removeCover(@Param('id') id: string) {
    return this.posts.removeCover(id)
  }
}
