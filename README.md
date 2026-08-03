# Collaborative Project Management System

A modern full-stack collaborative project management platform inspired by tools like Jira and Linear.

The application allows users to create and manage projects, collaborate with other users through invite-based project membership, and manage tasks with role-based access control.

The project is built with a production-oriented architecture using Next.js, TypeScript, Prisma, PostgreSQL, and Clerk.

---

## Overview

The goal of this project is to build a real-world collaborative project management system while applying practical software engineering concepts such as:

- Authentication and authorization
- Role-based access control
- Relational database design
- Service-layer architecture
- API design
- Project and task management
- Invite-based collaboration
- Production deployment
- Scalable backend architecture

This project is being developed with a focus on building industry-relevant engineering skills rather than creating a basic CRUD application.

---

## Current Features

### Authentication

- Clerk-based user authentication
- JWT-based authentication for protected API routes
- Centralized authentication service
- User synchronization between Clerk and PostgreSQL
- Authenticated API requests

### Project Management

- Create projects
- View projects
- Edit projects
- Delete projects
- Generate unique invite codes
- Invite-based project joining
- Project membership
- Project roles
- Owner and Admin permissions
- Member-based project access

### Task Management

- Create tasks
- View tasks
- Update tasks
- Delete tasks
- Update task status
- Assign tasks to project members
- Task creator tracking
- Task assignee tracking
- Due dates / deadlines
- Project-based task management

### Dashboard

- Project overview
- Project statistics
- Task statistics
- Task status information
- Data-driven dashboard

### Frontend

- Responsive UI
- Project management interface
- Task management interface
- Task detail pages
- Project detail pages
- Loading states
- Error handling
- Empty states
- Role-aware UI behavior

---

# Architecture

The application follows a layered architecture to maintain separation of concerns between API routes, authentication, business logic, and database operations.

```text
Client
  │
  ▼
Next.js Frontend
  │
  ▼
API Route Handlers
  │
  ▼
Authentication Layer
  │
  ▼
Service Layer
  │
  ▼
Prisma ORM
  │
  ▼
PostgreSQL
Architecture Layers
Frontend

Responsible for:

Rendering UI
User interactions
Form handling
Calling backend APIs
Displaying loading and error states
API Layer

Responsible for:

HTTP request handling
Request validation
Authentication checks
Authorization checks
HTTP responses
Service Layer

Responsible for:

Business logic
Database operations
Project management
Task management
Membership operations
Database Layer

Responsible for:

Data persistence
Relationships
Constraints
Transactions
Tech Stack
Frontend
Next.js 15
React 19
TypeScript
Tailwind CSS
shadcn/ui
Backend
Next.js Route Handlers
TypeScript
REST-style API architecture
Database
PostgreSQL
Neon
Prisma ORM
Authentication
Clerk
JWT
Development Tools
Git
GitHub
Postman
Prisma Studio
VS Code
Deployment
Vercel
Neon PostgreSQL
Database Design

The application currently uses the following core entities:

User
 │
 ├──────────────┐
 │              │
 ▼              ▼
ProjectMember  Task
 │              │
 ▼              ▼
Project       Assignee
User

Stores application users synchronized from Clerk.

User
├── id
├── clerkId
├── email
├── name
├── imageUrl
├── createdAt
└── updatedAt
Project

Represents a collaborative project.

Project
├── id
├── name
├── description
├── inviteCode
├── status
├── createdAt
└── updatedAt
ProjectMember

Connects users with projects.

ProjectMember
├── id
├── projectId
├── userId
├── role
└── joinedAt

Supported roles:

OWNER
ADMIN
MEMBER
Task

Represents work that needs to be completed inside a project.

Task
├── id
├── title
├── description
├── status
├── dueDate
├── order
├── projectId
├── createdById
├── assigneeId
├── createdAt
└── updatedAt
Authentication Flow
User
 │
 ▼
Clerk Authentication
 │
 ▼
JWT
 │
 ▼
Protected API Request
 │
 ▼
AuthService
 │
 ▼
Verify User
 │
 ▼
Find Database User
 │
 ▼
Authorized Request

The backend uses a centralized authentication service to identify the authenticated database user.

Protected API routes reject unauthenticated requests.

Project Creation Flow
Authenticated User
       │
       ▼
Create Project Request
       │
       ▼
Verify Authentication
       │
       ▼
Validate Request
       │
       ▼
Create Project
       │
       ▼
Generate Invite Code
       │
       ▼
Create OWNER Membership
       │
       ▼
Database Transaction
       │
       ▼
Return Project

The project creator automatically becomes the OWNER of the project.

Project Joining Flow

Users can join a project using an invite code.

Project Owner
     │
     ▼
Share Invite Code
     │
     ▼
User Opens Join Link
     │
     ▼
Authenticate User
     │
     ▼
Validate Invite Code
     │
     ▼
Check Existing Membership
     │
     ▼
Create ProjectMember
     │
     ▼
User Joins Project

A user cannot join the same project multiple times.

Task Management Flow
User
 │
 ▼
Select Project
 │
 ▼
Verify Project Membership
 │
 ▼
Create Task
 │
 ├── Title
 ├── Description
 ├── Status
 ├── Due Date
 └── Assignee
 │
 ▼
TaskService
 │
 ▼
Prisma
 │
 ▼
PostgreSQL

Tasks belong to a project and can be assigned to project members.

The task creator is stored separately from the task assignee.

API Endpoints
Projects
Create Project
POST /api/v1/projects

Creates a new project and automatically adds the authenticated user as OWNER.

Get User Projects
GET /api/v1/projects

Returns projects where the authenticated user is a member.

Join Project
POST /api/v1/projects/join/[inviteCode]

Joins a project using a valid invite code.

Tasks
Get Tasks
GET /api/v1/tasks

Returns tasks available to the authenticated user.

Optional project filtering:

GET /api/v1/tasks?projectId=<projectId>
Create Task
POST /api/v1/tasks

Creates a task inside a project.

Example request:

{
  "title": "Implement authentication middleware",
  "description": "Add authentication validation for protected API routes",
  "projectId": "project_id",
  "status": "TODO",
  "assigneeId": "user_id",
  "dueDate": "2026-08-10"
}
Update Task
PATCH /api/v1/tasks/[id]

Updates an existing task.

Delete Task
DELETE /api/v1/tasks/[id]

Deletes an existing task.

Project Structure
src/
│
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── projects/
│   │       └── tasks/
│   │
│   ├── projects/
│   │
│   ├── tasks/
│   │
│   └── dashboard/
│
├── components/
│   ├── ui/
│   └── ...
│
├── services/
│   ├── auth.service.ts
│   ├── project.service.ts
│   └── task.service.ts
│
├── lib/
│   ├── prisma.ts
│   └── ...
│
├── types/
│
└── prisma/
    └── schema.prisma
Environment Variables

Create a .env.local file:

DATABASE_URL="your_neon_database_url"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_clerk_publishable_key"

CLERK_SECRET_KEY="your_clerk_secret_key"

Never commit environment variables or secrets to GitHub.

Local Development
1. Clone the repository
git clone <repository-url>
cd <project-directory>
2. Install dependencies
npm install
3. Configure environment variables

Create:

.env.local

Add the required environment variables.

4. Generate Prisma Client
npx prisma generate
5. Run database migrations
npx prisma migrate dev
6. Start development server
npm run dev

Open:

http://localhost:3000
Development Workflow

Future features are developed using a structured GitHub workflow.

GitHub Issue
     │
     ▼
Feature Branch
     │
     ▼
Implementation
     │
     ▼
Logical Commits
     │
     ▼
Local Testing
     │
     ▼
Pull Request
     │
     ▼
Code Review
     │
     ▼
Merge
     │
     ▼
Production Deployment

Example:

git checkout -b feature/task-comments

After implementation:

git add .
git commit -m "feat: add task comments"
git push origin feature/task-comments

Then create a Pull Request and merge after review and testing.

Production Deployment

The application is designed to be deployed using:

Frontend + API
      │
      ▼
Vercel
      │
      ▼
Neon PostgreSQL

Production deployment requires:

Production environment variables
Clerk production configuration
Production database connection
Prisma client generation
Authentication verification
API authorization verification
Current Development Status
Module	Status
Authentication	Complete
JWT API Authentication	Complete
User Synchronization	Complete
Database Setup	Complete
Prisma Integration	Complete
Project Creation	Complete
Project CRUD	Complete
Project Membership	Complete
Invite Code	Complete
Join Project	Complete
Role-Based Access	Complete
Task CRUD	Complete
Task Assignment	Complete
Task Status	Complete
Task Due Dates	Complete
Dashboard	Complete
Frontend-Backend Integration	Complete
Basic Error Handling	Complete
Production Deployment	In Progress
Automated Testing	Planned
CI/CD	Planned
Performance Optimization	Planned
Redis Caching	Planned
Background Jobs	Planned
Real-Time Updates	Planned
Notifications	Planned
Future Improvements

The project will continue to evolve with production-oriented features.

Collaboration
Task comments
Activity history
Mentions
File attachments
Notifications
Task assignment notifications
Deadline reminders
Overdue task notifications
Project invitations
Productivity
Task search
Filtering
Sorting
Pagination
Advanced task analytics
Engineering
Unit testing
Integration testing
End-to-end testing
GitHub Actions CI/CD
Database query optimization
Database indexing
Redis caching
Rate limiting
Scalable Architecture
Background job processing
Real-time updates with WebSockets
Structured logging
Monitoring
Error tracking
Project Goal

The goal of this project is to build a production-oriented collaborative project management platform while demonstrating practical software engineering skills.

The project focuses on:

Full-stack development
Backend architecture
Authentication
Authorization
Role-based access control
Relational database design
API development
Performance optimization
Testing
CI/CD
Scalable system design

The long-term goal is to evolve the application from a functional project management platform into a production-grade system capable of handling real-world collaboration and scale.