export type Badge = 'new' | 'founder' | 'partner'

export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  sector: string | null
  city: string | null
  country: string
  website: string | null
  linkedin: string | null
  company_number: string | null
  badge: Badge
  profile_completion: number
  is_approved: boolean
  created_at: string
}

export type Application = {
  id: string
  full_name: string
  email: string
  activity: string
  city: string
  country: string
  why_join: string
  company_number: string | null
  linkedin: string | null
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
  forum_replies?: ForumReply[]
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
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export type Connection = {
  id: string
  requester_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export type Recommendation = {
  id: string
  author_id: string
  target_id: string
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
