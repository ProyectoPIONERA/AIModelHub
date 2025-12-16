--
-- PostgreSQL database dump
--

\restrict btNvnZeUIsyhSbEBMyRgL5KPCDSMBXXJ51TtfDKPEzacQcOdMySfBqM1TiUlUk5

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id character varying(255) NOT NULL,
    name character varying(500) NOT NULL,
    version character varying(50) DEFAULT '1.0'::character varying,
    content_type character varying(100) DEFAULT 'application/octet-stream'::character varying,
    description text,
    short_description character varying(1000),
    keywords text,
    byte_size bigint,
    format character varying(100),
    asset_type character varying(100) DEFAULT 'MLModel'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    owner character varying(100) DEFAULT 'conn-oeg-demo'::character varying
);


--
-- Name: TABLE assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.assets IS 'Main table for ML assets metadata';


--
-- Name: COLUMN assets.owner; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.owner IS 'Connector ID of the user who owns this asset (e.g., conn-oeg-demo)';


--
-- Name: data_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_addresses (
    id integer NOT NULL,
    asset_id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    name character varying(500),
    base_url text,
    path text,
    auth_key character varying(255),
    auth_code character varying(255),
    secret_name character varying(255),
    proxy_body character varying(50),
    proxy_path character varying(50),
    proxy_query_params character varying(50),
    proxy_method character varying(50),
    region character varying(100),
    bucket_name character varying(255),
    access_key_id character varying(255),
    secret_access_key character varying(500),
    endpoint_override text,
    key_prefix character varying(500),
    folder_name character varying(500),
    folder character varying(500),
    file_name character varying(500),
    s3_key character varying(1000),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE data_addresses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_addresses IS 'Storage configuration for assets (HTTP, S3, InesDataStore)';


--
-- Name: ml_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_metadata (
    asset_id character varying(255) NOT NULL,
    task character varying(200),
    subtask character varying(200),
    algorithm character varying(200),
    library character varying(200),
    framework character varying(200),
    software character varying(200),
    programming_language character varying(100),
    license character varying(200),
    version character varying(50),
    input_features jsonb
);


--
-- Name: TABLE ml_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_metadata IS 'ML-specific metadata from JS_Pionera_Ontology';


--
-- Name: assets_complete; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assets_complete AS
 SELECT a.id,
    a.name,
    a.version,
    a.content_type,
    a.description,
    a.short_description,
    a.keywords,
    a.byte_size,
    a.format,
    a.asset_type,
    a.created_at,
    a.updated_at,
    m.task,
    m.subtask,
    m.algorithm,
    m.library,
    m.framework,
    m.software,
    m.programming_language,
    m.license AS ml_license,
    da.type AS storage_type,
    da.bucket_name,
    da.s3_key,
    da.base_url
   FROM ((public.assets a
     LEFT JOIN public.ml_metadata m ON (((a.id)::text = (m.asset_id)::text)))
     LEFT JOIN public.data_addresses da ON (((a.id)::text = (da.asset_id)::text)));


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    connector_id character varying(100) NOT NULL,
    display_name character varying(200),
    email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'User authentication table for multi-tenant connector system';


--
-- Name: assets_with_owner; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assets_with_owner AS
 SELECT a.id,
    a.name,
    a.version,
    a.content_type,
    a.description,
    a.short_description,
    a.keywords,
    a.byte_size,
    a.format,
    a.asset_type,
    a.created_at,
    a.updated_at,
    a.owner,
    u.display_name AS owner_display_name,
    u.connector_id AS owner_connector_id
   FROM (public.assets a
     LEFT JOIN public.users u ON (((a.owner)::text = (u.connector_id)::text)));


--
-- Name: contract_definition_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_definition_assets (
    contract_definition_id character varying(255) NOT NULL,
    asset_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE contract_definition_assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contract_definition_assets IS 'Junction table for assets in contract definitions';


--
-- Name: contract_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_definitions (
    id character varying(255) NOT NULL,
    access_policy_id character varying(255) NOT NULL,
    contract_policy_id character varying(255) NOT NULL,
    assets_selector jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255)
);


--
-- Name: TABLE contract_definitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contract_definitions IS 'EDC Contract Definitions linking policies to assets';


--
-- Name: data_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.data_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: data_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.data_addresses_id_seq OWNED BY public.data_addresses.id;


--
-- Name: policy_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_definitions (
    id character varying(255) NOT NULL,
    policy jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255)
);


--
-- Name: TABLE policy_definitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_definitions IS 'EDC Policy Definitions (ODRL format)';


--
-- Name: upload_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_chunks (
    id integer NOT NULL,
    session_id integer NOT NULL,
    chunk_index integer NOT NULL,
    etag character varying(255),
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE upload_chunks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.upload_chunks IS 'Individual chunks for multipart uploads';


--
-- Name: upload_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.upload_chunks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: upload_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.upload_chunks_id_seq OWNED BY public.upload_chunks.id;


--
-- Name: upload_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_sessions (
    id integer NOT NULL,
    asset_id character varying(255) NOT NULL,
    file_name character varying(500) NOT NULL,
    total_chunks integer NOT NULL,
    uploaded_chunks integer DEFAULT 0,
    s3_upload_id character varying(500),
    status character varying(50) DEFAULT 'in_progress'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    owner character varying(100) DEFAULT 'conn-oeg-demo'::character varying
);


--
-- Name: TABLE upload_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.upload_sessions IS 'Tracking chunked file uploads to MinIO';


--
-- Name: COLUMN upload_sessions.owner; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_sessions.owner IS 'Connector ID of the user who owns this upload session';


--
-- Name: upload_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.upload_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: upload_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.upload_sessions_id_seq OWNED BY public.upload_sessions.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: data_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_addresses ALTER COLUMN id SET DEFAULT nextval('public.data_addresses_id_seq'::regclass);


--
-- Name: upload_chunks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_chunks ALTER COLUMN id SET DEFAULT nextval('public.upload_chunks_id_seq'::regclass);


--
-- Name: upload_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions ALTER COLUMN id SET DEFAULT nextval('public.upload_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: contract_definition_assets contract_definition_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_pkey PRIMARY KEY (contract_definition_id, asset_id);


--
-- Name: contract_definitions contract_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_pkey PRIMARY KEY (id);


--
-- Name: data_addresses data_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_addresses
    ADD CONSTRAINT data_addresses_pkey PRIMARY KEY (id);


--
-- Name: ml_metadata ml_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_pkey PRIMARY KEY (asset_id);


--
-- Name: policy_definitions policy_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_definitions
    ADD CONSTRAINT policy_definitions_pkey PRIMARY KEY (id);


--
-- Name: upload_chunks upload_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_pkey PRIMARY KEY (id);


--
-- Name: upload_chunks upload_chunks_session_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_session_id_chunk_index_key UNIQUE (session_id, chunk_index);


--
-- Name: upload_sessions upload_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_connector_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_connector_id_key UNIQUE (connector_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_assets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_created_at ON public.assets USING btree (created_at DESC);


--
-- Name: idx_assets_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_owner ON public.assets USING btree (owner);


--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_type ON public.assets USING btree (asset_type);


--
-- Name: idx_contract_definition_assets_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_definition_assets_asset_id ON public.contract_definition_assets USING btree (asset_id);


--
-- Name: idx_contract_definitions_access_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_definitions_access_policy ON public.contract_definitions USING btree (access_policy_id);


--
-- Name: idx_contract_definitions_contract_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_definitions_contract_policy ON public.contract_definitions USING btree (contract_policy_id);


--
-- Name: idx_contract_definitions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_definitions_created_at ON public.contract_definitions USING btree (created_at DESC);


--
-- Name: idx_data_addresses_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_addresses_asset_id ON public.data_addresses USING btree (asset_id);


--
-- Name: idx_data_addresses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_addresses_type ON public.data_addresses USING btree (type);


--
-- Name: idx_ml_metadata_algorithm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_metadata_algorithm ON public.ml_metadata USING btree (algorithm);


--
-- Name: idx_ml_metadata_input_features; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_metadata_input_features ON public.ml_metadata USING gin (input_features);


--
-- Name: idx_ml_metadata_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_metadata_task ON public.ml_metadata USING btree (task);


--
-- Name: idx_policy_definitions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_definitions_created_at ON public.policy_definitions USING btree (created_at DESC);


--
-- Name: idx_upload_sessions_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_asset_id ON public.upload_sessions USING btree (asset_id);


--
-- Name: idx_upload_sessions_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_owner ON public.upload_sessions USING btree (owner);


--
-- Name: idx_upload_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_status ON public.upload_sessions USING btree (status);


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contract_definitions update_contract_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contract_definitions_updated_at BEFORE UPDATE ON public.contract_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: policy_definitions update_policy_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_policy_definitions_updated_at BEFORE UPDATE ON public.policy_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: upload_sessions update_upload_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_upload_sessions_updated_at BEFORE UPDATE ON public.upload_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contract_definition_assets contract_definition_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: contract_definition_assets contract_definition_assets_contract_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_contract_definition_id_fkey FOREIGN KEY (contract_definition_id) REFERENCES public.contract_definitions(id) ON DELETE CASCADE;


--
-- Name: contract_definitions contract_definitions_access_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_access_policy_id_fkey FOREIGN KEY (access_policy_id) REFERENCES public.policy_definitions(id) ON DELETE RESTRICT;


--
-- Name: contract_definitions contract_definitions_contract_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_contract_policy_id_fkey FOREIGN KEY (contract_policy_id) REFERENCES public.policy_definitions(id) ON DELETE RESTRICT;


--
-- Name: data_addresses data_addresses_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_addresses
    ADD CONSTRAINT data_addresses_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: ml_metadata ml_metadata_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: ml_metadata ml_metadata_asset_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_asset_id_fkey1 FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: upload_chunks upload_chunks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.upload_sessions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict btNvnZeUIsyhSbEBMyRgL5KPCDSMBXXJ51TtfDKPEzacQcOdMySfBqM1TiUlUk5

