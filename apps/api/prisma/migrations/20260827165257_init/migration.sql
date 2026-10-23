-- Create ENUM
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE "CardForm" AS ENUM ('affirmative', 'negated');
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE "RoomVisibility" AS ENUM ('public', 'private');
CREATE TYPE "RoomMode" AS ENUM ('general', 'category');
CREATE TYPE "RoomStatus" AS ENUM ('lobby', 'playing', 'finished');
CREATE TYPE "VoteChoice" AS ENUM ('truth', 'myth');
CREATE TYPE "TournamentStatus" AS ENUM ('registration', 'running', 'finished');
CREATE TYPE "MatchupStatus" AS ENUM ('pending', 'ready', 'playing', 'finished');

-- Create table
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "facts" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "source_ref" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "facts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "fact_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "is_true" BOOLEAN NOT NULL,
    "form" "CardForm" NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_translations" (
    "card_id" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "card_translations_pkey" PRIMARY KEY ("card_id","locale")
);

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "totp_secret" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "friendships" (
    "user_id" INTEGER NOT NULL,
    "friend_id" INTEGER NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_id","friend_id")
);

CREATE TABLE "user_seen_facts" (
    "user_id" INTEGER NOT NULL,
    "fact_id" INTEGER NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_seen_facts_pkey" PRIMARY KEY ("user_id","fact_id")
);

CREATE TABLE "bot_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "accuracy_by_category" JSONB NOT NULL,
    "reaction_ms_mean" INTEGER NOT NULL,
    "reaction_ms_stddev" INTEGER NOT NULL,

    CONSTRAINT "bot_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "RoomVisibility" NOT NULL DEFAULT 'public',
    "mode" "RoomMode" NOT NULL DEFAULT 'general',
    "category_id" INTEGER,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "host_user_id" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'lobby',
    "max_players" INTEGER NOT NULL DEFAULT 6,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_settings" (
    "room_id" INTEGER NOT NULL,
    "card_count" INTEGER NOT NULL DEFAULT 20,
    "category_ids" INTEGER[],
    "answer_window_ms" INTEGER NOT NULL DEFAULT 10000,
    "combo_enabled" BOOLEAN NOT NULL DEFAULT true,
    "double_card_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "room_settings_pkey" PRIMARY KEY ("room_id")
);

CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "tournament_id" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "card_count" INTEGER NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_cards" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "card_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "is_double" BOOLEAN NOT NULL DEFAULT false,
    "served_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "revealed_at" TIMESTAMP(3),

    CONSTRAINT "match_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_players" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "combo_current" INTEGER NOT NULL DEFAULT 0,
    "combo_max" INTEGER NOT NULL DEFAULT 0,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "disconnected_at" TIMESTAMP(3),
    "final_rank" INTEGER,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answers" (
    "id" SERIAL NOT NULL,
    "match_card_id" INTEGER NOT NULL,
    "match_player_id" INTEGER NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_reaction_ms" INTEGER NOT NULL,
    "rtt_ms" INTEGER NOT NULL,
    "accepted_reaction_ms" INTEGER NOT NULL,
    "reaction_trusted" BOOLEAN NOT NULL DEFAULT true,
    "is_correct" BOOLEAN NOT NULL,
    "points_awarded" INTEGER NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'registration',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "card_count" INTEGER NOT NULL DEFAULT 10,
    "size" INTEGER NOT NULL DEFAULT 4,
    "created_by_id" INTEGER,
    "winner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_participants" (
    "tournament_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "eliminated_at" TIMESTAMP(3),
    "round" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("tournament_id","user_id")
);

CREATE TABLE "tournament_matchups" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "player_a_id" INTEGER,
    "player_b_id" INTEGER,
    "room_id" INTEGER,
    "match_id" INTEGER,
    "winner_id" INTEGER,
    "status" "MatchupStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "tournament_matchups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_achievements" (
    "user_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","achievement_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "facts_source_ref_key" ON "facts"("source_ref");
CREATE INDEX "facts_category_id_difficulty_active_idx" ON "facts"("category_id", "difficulty", "active");
CREATE INDEX "cards_fact_id_is_true_idx" ON "cards"("fact_id", "is_true");
CREATE UNIQUE INDEX "cards_fact_id_form_key" ON "cards"("fact_id", "form");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_display_name_key" ON "users"("display_name");
CREATE INDEX "users_is_bot_idx" ON "users"("is_bot");
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_user_id_key" ON "oauth_accounts"("provider", "provider_user_id");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "friendships_friend_id_idx" ON "friendships"("friend_id");
CREATE UNIQUE INDEX "bot_profiles_user_id_key" ON "bot_profiles"("user_id");
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");
CREATE INDEX "rooms_visibility_status_idx" ON "rooms"("visibility", "status");
CREATE INDEX "matches_room_id_idx" ON "matches"("room_id");
CREATE INDEX "matches_tournament_id_idx" ON "matches"("tournament_id");
CREATE UNIQUE INDEX "match_cards_match_id_position_key" ON "match_cards"("match_id", "position");
CREATE INDEX "match_players_user_id_idx" ON "match_players"("user_id");
CREATE UNIQUE INDEX "match_players_match_id_user_id_key" ON "match_players"("match_id", "user_id");
CREATE INDEX "answers_match_player_id_idx" ON "answers"("match_player_id");
CREATE UNIQUE INDEX "answers_match_card_id_match_player_id_key" ON "answers"("match_card_id", "match_player_id");
CREATE UNIQUE INDEX "tournament_matchups_room_id_key" ON "tournament_matchups"("room_id");
CREATE UNIQUE INDEX "tournament_matchups_match_id_key" ON "tournament_matchups"("match_id");
CREATE UNIQUE INDEX "tournament_matchups_tournament_id_round_slot_key" ON "tournament_matchups"("tournament_id", "round", "slot");
CREATE UNIQUE INDEX "achievements_slug_key" ON "achievements"("slug");

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cards" ADD CONSTRAINT "cards_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_translations" ADD CONSTRAINT "card_translations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_seen_facts" ADD CONSTRAINT "user_seen_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_seen_facts" ADD CONSTRAINT "user_seen_facts_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_cards" ADD CONSTRAINT "match_cards_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_cards" ADD CONSTRAINT "match_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_match_card_id_fkey" FOREIGN KEY ("match_card_id") REFERENCES "match_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_matchups" ADD CONSTRAINT "tournament_matchups_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_matchups" ADD CONSTRAINT "tournament_matchups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
