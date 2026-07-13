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
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions('cms:read')
  list() {
    return this.categories.list()
  }

  @Post()
  @RequirePermissions('cms:write')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('cms:write')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('cms:delete')
  remove(@Param('id') id: string) {
    return this.categories.remove(id)
  }
}

@Controller('admin/tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermissions('cms:read')
  list() {
    return this.tags.list()
  }

  @Post()
  @RequirePermissions('cms:write')
  create(@Body() dto: UpsertTagDto) {
    return this.tags.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('cms:write')
  update(@Param('id') id: string, @Body() dto: UpsertTagDto) {
    return this.tags.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('cms:delete')
  remove(@Param('id') id: string) {
    return this.tags.remove(id)
  }
}

@Controller('admin/posts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminPostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly views: ViewsService,
  ) {}

  @Get()
  @RequirePermissions('cms:read')
  list() {
    return this.posts.listAdmin()
  }

  @Get('analytics/overview')
  @RequirePermissions('cms:read')
  overview() {
    return this.views.overview()
  }

  @Get(':id')
  @RequirePermissions('cms:read')
  get(@Param('id') id: string) {
    return this.posts.getAdmin(id)
  }

  @Get(':id/analytics')
  @RequirePermissions('cms:read')
  analytics(@Param('id') id: string) {
    return this.views.postAnalytics(id)
  }

  @Post()
  @RequirePermissions('cms:write')
  create(@Body() dto: CreatePostDto, @CurrentUser() user: SafeUser) {
    return this.posts.create(user.id, dto.title)
  }

  @Patch(':id')
  @RequirePermissions('cms:write')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(id, dto)
  }

  @Post(':id/publish')
  @RequirePermissions('cms:publish')
  publish(@Param('id') id: string) {
    return this.posts.publish(id)
  }

  @Post(':id/unpublish')
  @RequirePermissions('cms:publish')
  unpublish(@Param('id') id: string) {
    return this.posts.unpublish(id)
  }

  @Post(':id/archive')
  @RequirePermissions('cms:publish')
  archive(@Param('id') id: string) {
    return this.posts.archive(id)
  }

  @Post(':id/unarchive')
  @RequirePermissions('cms:publish')
  unarchive(@Param('id') id: string) {
    return this.posts.unarchive(id)
  }

  @Delete(':id')
  @RequirePermissions('cms:delete')
  remove(@Param('id') id: string) {
    return this.posts.remove(id)
  }

  // ── capa (R2) ──
  @Post(':id/cover')
  @RequirePermissions('cms:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  setCover(@Param('id') id: string, @UploadedFile() file: UploadedImage) {
    return this.posts.setCover(id, file)
  }

  @Delete(':id/cover')
  @RequirePermissions('cms:write')
  removeCover(@Param('id') id: string) {
    return this.posts.removeCover(id)
  }
}
