export type Profile = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  avatar_url: string | null
  bio: string | null
  activity: string | null
  city: string | null
  country: string | null
  website: string | null
  company_number: string | null
  badges: string[]
  is_active: boolean
  created_at: string
  [key: string]: unknown
}

export type Application = {
  id: string
  first_name: string
  last_name: string
  email: string
  activity: string
  city: string
  country: string
  why: string
  company_number: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  content: string
  created_at: string
  profiles?: Profile
  comments?: Comment[]
}

export type Comment = {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export type ForumCategory = {
  id: string
  name: string
  description: string | null
  slug: string
  created_at: string
}

export type ForumTopic = {
  id: string
  category_id: string
  author_id: string
  title: string
  content: string
  created_at: string
  profiles?: Profile
}

export type ForumReply = {
  id: string
  topic_id: string
  author_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export type Connection = {
  id: string
  requester_id: string
  receiver_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export type Recommendation = {
  id: string
  author_id: string
  recommended_id: string
  content: string
  created_at: string
  author?: Profile
}

export type Notification = {
  id: string
  user_id: string
  type: string
  content: string
  read: boolean
  link: string | null
  created_at: string
}
