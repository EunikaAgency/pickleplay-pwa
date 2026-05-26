# Data Model — PicklePlay PWA

## Entity Relationship Overview

```
users
  ├──< games (organizer)
  ├──< game_participants
  ├──< clubs (creator)
  ├──< club_members
  ├──< messages (sender)
  ├──< player_lists (owner)
  ├──< favorites
  ├──< notifications (recipient)
  └──< activity_feed (actor)

courts
  ├──< games
  └──< favorites (polymorphic)

games
  ├──< game_participants
  ├──< messages (context)
  └──< game_series (parent)

clubs
  ├──< club_members
  ├──< club_announcements
  ├──< club_library
  ├──< messages (context)
  └──< favorites (polymorphic)
```

## Core Tables (Phase 1)

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  skill_level DECIMAL(3,1),
  skill_source VARCHAR(50) DEFAULT 'self_reported',
  home_lat DECIMAL(10,7),
  home_lng DECIMAL(10,7),
  home_location_name VARCHAR(255),
  onboarding_step INT DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### courts
```sql
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  court_count INT,
  surface VARCHAR(100),
  indoor_outdoor VARCHAR(50),
  amenities JSONB DEFAULT '[]',
  access_type VARCHAR(50) DEFAULT 'public',
  phone VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  booking_link TEXT,
  price_info VARCHAR(255),
  operating_hours JSONB,
  is_partner BOOLEAN DEFAULT FALSE,
  partner_since DATE,
  hero_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### games
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) DEFAULT 'game',
  format VARCHAR(50) DEFAULT 'quick',
  court_id UUID REFERENCES courts(id),
  organizer_id UUID REFERENCES users(id),
  co_host_id UUID REFERENCES users(id),
  skill_min DECIMAL(3,1),
  skill_max DECIMAL(3,1),
  player_limit INT,
  game_date DATE,
  start_time TIME,
  end_time TIME,
  visibility VARCHAR(20) DEFAULT 'public',
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_series_id UUID,
  payment_note TEXT,
  round_robin_config JSONB,
  beginner_friendly BOOLEAN DEFAULT FALSE,
  play_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### game_participants
```sql
CREATE TABLE game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'confirmed',
  guest_count INT DEFAULT 0,
  waitlist_position INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);
```

### clubs
```sql
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  visibility VARCHAR(20) DEFAULT 'public',
  skill_min DECIMAL(3,1),
  skill_max DECIMAL(3,1),
  photo_url TEXT,
  rules_text TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### club_members
```sql
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id),
  context_type VARCHAR(50) NOT NULL,
  context_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Phase 2 Additions

### game_series
```sql
CREATE TABLE game_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES users(id),
  template_game_id UUID REFERENCES games(id),
  recurrence_rule VARCHAR(100),
  day_of_week INT,
  next_generation_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### player_lists
```sql
CREATE TABLE player_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### player_list_members
```sql
CREATE TABLE player_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES player_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50)
);
```

## Phase 3 Additions

### favorites
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  favoritable_type VARCHAR(50) NOT NULL,
  favoritable_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, favoritable_type, favoritable_id)
);
```

### club_announcements
```sql
CREATE TABLE club_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  title VARCHAR(255),
  body TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### club_library
```sql
CREATE TABLE club_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  title VARCHAR(255),
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### activity_feed
```sql
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  subject_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  visibility VARCHAR(50) DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Indexes

```sql
-- High-traffic lookups
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_court ON games(court_id);
CREATE INDEX idx_games_organizer ON games(organizer_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_visibility ON games(visibility);

CREATE INDEX idx_game_participants_game ON game_participants(game_id);
CREATE INDEX idx_game_participants_user ON game_participants(user_id);

CREATE INDEX idx_messages_context ON messages(context_type, context_id);
CREATE INDEX idx_messages_created ON messages(created_at);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE INDEX idx_courts_location ON courts(lat, lng);

CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_club_members_user ON club_members(user_id);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at);
```
