--
-- PostgreSQL database dump
--

\restrict tc4TUFTRReVJkSWi8I0ur9xGa4DDhYMpUtngFDNd9wPcRo3m1fahOqfpIJ0YYoE

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

ALTER TABLE IF EXISTS ONLY public.upload_chunks DROP CONSTRAINT IF EXISTS upload_chunks_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ml_metadata DROP CONSTRAINT IF EXISTS ml_metadata_asset_id_fkey1;
ALTER TABLE IF EXISTS ONLY public.ml_metadata DROP CONSTRAINT IF EXISTS ml_metadata_asset_id_fkey;
ALTER TABLE IF EXISTS ONLY public.data_addresses DROP CONSTRAINT IF EXISTS data_addresses_asset_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contract_definitions DROP CONSTRAINT IF EXISTS contract_definitions_contract_policy_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contract_definitions DROP CONSTRAINT IF EXISTS contract_definitions_access_policy_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contract_definition_assets DROP CONSTRAINT IF EXISTS contract_definition_assets_contract_definition_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contract_definition_assets DROP CONSTRAINT IF EXISTS contract_definition_assets_asset_id_fkey;
DROP TRIGGER IF EXISTS update_upload_sessions_updated_at ON public.upload_sessions;
DROP TRIGGER IF EXISTS update_policy_definitions_updated_at ON public.policy_definitions;
DROP TRIGGER IF EXISTS update_contract_definitions_updated_at ON public.contract_definitions;
DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
DROP INDEX IF EXISTS public.idx_upload_sessions_status;
DROP INDEX IF EXISTS public.idx_upload_sessions_owner;
DROP INDEX IF EXISTS public.idx_upload_sessions_asset_id;
DROP INDEX IF EXISTS public.idx_policy_definitions_created_at;
DROP INDEX IF EXISTS public.idx_ml_metadata_task;
DROP INDEX IF EXISTS public.idx_ml_metadata_input_features;
DROP INDEX IF EXISTS public.idx_ml_metadata_algorithm;
DROP INDEX IF EXISTS public.idx_data_addresses_type;
DROP INDEX IF EXISTS public.idx_data_addresses_asset_id;
DROP INDEX IF EXISTS public.idx_contract_definitions_created_at;
DROP INDEX IF EXISTS public.idx_contract_definitions_contract_policy;
DROP INDEX IF EXISTS public.idx_contract_definitions_access_policy;
DROP INDEX IF EXISTS public.idx_contract_definition_assets_asset_id;
DROP INDEX IF EXISTS public.idx_assets_type;
DROP INDEX IF EXISTS public.idx_assets_owner;
DROP INDEX IF EXISTS public.idx_assets_created_at;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_connector_id_key;
ALTER TABLE IF EXISTS ONLY public.upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.upload_chunks DROP CONSTRAINT IF EXISTS upload_chunks_session_id_chunk_index_key;
ALTER TABLE IF EXISTS ONLY public.upload_chunks DROP CONSTRAINT IF EXISTS upload_chunks_pkey;
ALTER TABLE IF EXISTS ONLY public.policy_definitions DROP CONSTRAINT IF EXISTS policy_definitions_pkey;
ALTER TABLE IF EXISTS ONLY public.ml_metadata DROP CONSTRAINT IF EXISTS ml_metadata_pkey;
ALTER TABLE IF EXISTS ONLY public.data_addresses DROP CONSTRAINT IF EXISTS data_addresses_pkey;
ALTER TABLE IF EXISTS ONLY public.contract_definitions DROP CONSTRAINT IF EXISTS contract_definitions_pkey;
ALTER TABLE IF EXISTS ONLY public.contract_definition_assets DROP CONSTRAINT IF EXISTS contract_definition_assets_pkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.upload_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.upload_chunks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.data_addresses ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP SEQUENCE IF EXISTS public.upload_sessions_id_seq;
DROP TABLE IF EXISTS public.upload_sessions;
DROP SEQUENCE IF EXISTS public.upload_chunks_id_seq;
DROP TABLE IF EXISTS public.upload_chunks;
DROP TABLE IF EXISTS public.policy_definitions;
DROP SEQUENCE IF EXISTS public.data_addresses_id_seq;
DROP TABLE IF EXISTS public.contract_definitions;
DROP TABLE IF EXISTS public.contract_definition_assets;
DROP VIEW IF EXISTS public.assets_with_owner;
DROP TABLE IF EXISTS public.users;
DROP VIEW IF EXISTS public.assets_complete;
DROP TABLE IF EXISTS public.ml_metadata;
DROP TABLE IF EXISTS public.data_addresses;
DROP TABLE IF EXISTS public.assets;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: ml_assets_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO ml_assets_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: ml_assets_user
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
    owner character varying(100) DEFAULT 'conn-user1-demo'::character varying
);


ALTER TABLE public.assets OWNER TO ml_assets_user;

--
-- Name: TABLE assets; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.assets IS 'Main table for IA assets metadata';


--
-- Name: COLUMN assets.owner; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON COLUMN public.assets.owner IS 'Connector ID of the user who owns this asset (e.g., conn-user1-demo)';


--
-- Name: data_addresses; Type: TABLE; Schema: public; Owner: ml_assets_user
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


ALTER TABLE public.data_addresses OWNER TO ml_assets_user;

--
-- Name: TABLE data_addresses; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.data_addresses IS 'Storage configuration for assets (HTTP, S3, InesDataStore)';


--
-- Name: ml_metadata; Type: TABLE; Schema: public; Owner: ml_assets_user
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


ALTER TABLE public.ml_metadata OWNER TO ml_assets_user;

--
-- Name: TABLE ml_metadata; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.ml_metadata IS 'ML-specific metadata from JS_Pionera_Ontology';


--
-- Name: assets_complete; Type: VIEW; Schema: public; Owner: ml_assets_user
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


ALTER VIEW public.assets_complete OWNER TO ml_assets_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ml_assets_user
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


ALTER TABLE public.users OWNER TO ml_assets_user;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.users IS 'User authentication table for multi-tenant connector system';


--
-- Name: assets_with_owner; Type: VIEW; Schema: public; Owner: ml_assets_user
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


ALTER VIEW public.assets_with_owner OWNER TO ml_assets_user;

--
-- Name: contract_definition_assets; Type: TABLE; Schema: public; Owner: ml_assets_user
--

CREATE TABLE public.contract_definition_assets (
    contract_definition_id character varying(255) NOT NULL,
    asset_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.contract_definition_assets OWNER TO ml_assets_user;

--
-- Name: TABLE contract_definition_assets; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.contract_definition_assets IS 'Junction table for assets in contract definitions';


--
-- Name: contract_definitions; Type: TABLE; Schema: public; Owner: ml_assets_user
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


ALTER TABLE public.contract_definitions OWNER TO ml_assets_user;

--
-- Name: TABLE contract_definitions; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.contract_definitions IS 'EDC Contract Definitions linking policies to assets';


--
-- Name: data_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: ml_assets_user
--

CREATE SEQUENCE public.data_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_addresses_id_seq OWNER TO ml_assets_user;

--
-- Name: data_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ml_assets_user
--

ALTER SEQUENCE public.data_addresses_id_seq OWNED BY public.data_addresses.id;


--
-- Name: policy_definitions; Type: TABLE; Schema: public; Owner: ml_assets_user
--

CREATE TABLE public.policy_definitions (
    id character varying(255) NOT NULL,
    policy jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255)
);


ALTER TABLE public.policy_definitions OWNER TO ml_assets_user;

--
-- Name: TABLE policy_definitions; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.policy_definitions IS 'EDC Policy Definitions (ODRL format)';


--
-- Name: upload_chunks; Type: TABLE; Schema: public; Owner: ml_assets_user
--

CREATE TABLE public.upload_chunks (
    id integer NOT NULL,
    session_id integer NOT NULL,
    chunk_index integer NOT NULL,
    etag character varying(255),
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.upload_chunks OWNER TO ml_assets_user;

--
-- Name: TABLE upload_chunks; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.upload_chunks IS 'Individual chunks for multipart uploads';


--
-- Name: upload_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: ml_assets_user
--

CREATE SEQUENCE public.upload_chunks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.upload_chunks_id_seq OWNER TO ml_assets_user;

--
-- Name: upload_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ml_assets_user
--

ALTER SEQUENCE public.upload_chunks_id_seq OWNED BY public.upload_chunks.id;


--
-- Name: upload_sessions; Type: TABLE; Schema: public; Owner: ml_assets_user
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
    owner character varying(100) DEFAULT 'conn-user1-demo'::character varying
);


ALTER TABLE public.upload_sessions OWNER TO ml_assets_user;

--
-- Name: TABLE upload_sessions; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON TABLE public.upload_sessions IS 'Tracking chunked file uploads to MinIO';


--
-- Name: COLUMN upload_sessions.owner; Type: COMMENT; Schema: public; Owner: ml_assets_user
--

COMMENT ON COLUMN public.upload_sessions.owner IS 'Connector ID of the user who owns this upload session';


--
-- Name: upload_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: ml_assets_user
--

CREATE SEQUENCE public.upload_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.upload_sessions_id_seq OWNER TO ml_assets_user;

--
-- Name: upload_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ml_assets_user
--

ALTER SEQUENCE public.upload_sessions_id_seq OWNED BY public.upload_sessions.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ml_assets_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ml_assets_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ml_assets_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: data_addresses id; Type: DEFAULT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.data_addresses ALTER COLUMN id SET DEFAULT nextval('public.data_addresses_id_seq'::regclass);


--
-- Name: upload_chunks id; Type: DEFAULT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_chunks ALTER COLUMN id SET DEFAULT nextval('public.upload_chunks_id_seq'::regclass);


--
-- Name: upload_sessions id; Type: DEFAULT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_sessions ALTER COLUMN id SET DEFAULT nextval('public.upload_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.assets VALUES ('ML_Model_001', 'ML_Model_001', '1.0', 'ml model', 'LightGBM classifier model for image classification tasks', 'ML_Model_001', 'classification,lgbm,computer-vision', 0, '', 'machineLearning', '2025-12-11 12:58:04.495868', '2025-12-11 14:35:26.036037', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ML_Model_002', 'ML_Model_002', '1.0', 'ml model', 'LightGBM regression model for time series prediction', 'ML_Model_002', 'regression,lgbm,time-series,forecasting', 0, 'pkl', 'machineLearning', '2025-12-11 13:07:56.696001', '2025-12-11 14:35:33.604023', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ML_Model_003', 'ML_Model_003', '1.0', 'ml model', '', 'ML_Model_003', '', 0, '', 'machineLearning', '2025-12-11 17:31:14.772751', '2025-12-11 17:31:14.772751', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ML_model_004', 'ML_model_004', '1.0', 'ml model', '', 'ML_model_004', '', 0, '', 'machineLearning', '2025-12-11 17:44:08.454517', '2025-12-11 17:44:08.454517', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('DL_Model_001', 'Deep Learning CNN Model', '1.0', 'deep learning model', 'Convolutional Neural Network for image classification', 'CNN Image Classifier', 'cnn,deep-learning,image-classification', 0, 'h5', 'deepLearning', '2025-12-11 18:01:27.738228', '2025-12-11 18:01:27.738228', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ML_model_005', 'ML_model_005', '1.0', 'ml model', '', 'ML_model_005', 'machine learning, regression, time series, forecasting, prediction', 0, '', 'deepLearning', '2025-12-11 17:53:43.153938', '2025-12-11 18:13:51.671636', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('external-model-1', 'External ML Model No Contract', '1.0', 'application/octet-stream', 'External model without contract', 'External no contract', 'ml,external,test', 1048576, 'h5', 'Model', '2025-12-12 00:55:52.753265', '2025-12-12 00:55:52.753265', 'conn-external-provider');
INSERT INTO public.assets VALUES ('iris-http-1765537190', 'Iris Random Forest Classifier (HTTP)', '1.0', 'application/octet-stream', 'Random Forest classifier trained on Iris dataset. Requires 4 input features: sepal length, sepal width, petal length, petal width.', 'Iris flower species classifier', 'iris,classification,random-forest,sklearn,flowers', 0, 'pickle', 'machineLearning', '2025-12-12 10:59:50.678751', '2025-12-12 10:59:50.678751', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('4dfe6d9e-c47d-4a5b-921a-32b762a3f564', 'Untitled Asset', '1.0', 'application/octet-stream', '', '', '', 0, '', 'MLModel', '2025-12-12 12:33:00.148425', '2025-12-12 12:33:00.148425', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('fdff25b6-66e4-40dd-9df1-6b6b6a8ebbb7', 'Untitled Asset', '1.0', 'application/octet-stream', '', '', '', 0, '', 'MLModel', '2025-12-12 12:33:31.393474', '2025-12-12 12:33:31.393474', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('af0c592f-4d11-4890-9d43-3627ab1b9218', 'Untitled Asset', '1.0', 'application/octet-stream', '', '', '', 0, '', 'MLModel', '2025-12-12 12:37:26.187712', '2025-12-12 12:37:26.187712', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ml_model_010', 'ml_model_010', '1.0', 'ml model', 'ml_model_010', 'ml_model_010', 'ml, model, finances', 1200, 'pkl', 'machineLearning', '2025-12-12 13:00:48.412292', '2025-12-12 13:00:48.412292', 'conn-user1-demo');
INSERT INTO public.assets VALUES ('ml_model_11', 'ml_model_11', '1.0', 'ml model', 'ml_model_11', 'ml_model_11', 'dp, logistc', 1200, 'pkl', 'deepLearning', '2025-12-12 13:27:38.621622', '2025-12-12 13:27:38.621622', 'conn-user2-demo');


--
-- Data for Name: contract_definition_assets; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.contract_definition_assets VALUES ('ml_contract_002', 'ML_Model_002', '2025-12-11 15:03:32.647688');
INSERT INTO public.contract_definition_assets VALUES ('ml_contract_with_constraints', 'ML_Model_001', '2025-12-11 15:30:41.793738');
INSERT INTO public.contract_definition_assets VALUES ('ml_contract_with_constraints', 'ML_Model_002', '2025-12-11 15:30:41.793738');
INSERT INTO public.contract_definition_assets VALUES ('contract_006', 'ML_model_004', '2025-12-12 00:32:56.458552');
INSERT INTO public.contract_definition_assets VALUES ('contract-iris-http-1765537190', 'iris-http-1765537190', '2025-12-12 10:59:50.807482');
INSERT INTO public.contract_definition_assets VALUES ('contract_001_ml', 'ml_model_010', '2025-12-12 13:02:15.527779');


--
-- Data for Name: contract_definitions; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.contract_definitions VALUES ('ml_contract_002', 'ID_POLICY_001', 'ID_POLICY_001', '[{"operator": "in", "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id", "operandRight": ["ML_Model_002"]}]', '2025-12-11 15:03:32.647688', '2025-12-11 15:03:32.647688', 'user-conn-user1-demo');
INSERT INTO public.contract_definitions VALUES ('ml_contract_with_constraints', 'ID_POLICY_WITH_CONSTRAINTS', 'ID_POLICY_WITH_CONSTRAINTS', '[{"operator": "in", "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id", "operandRight": ["ML_Model_001", "ML_Model_002"]}]', '2025-12-11 15:30:41.793738', '2025-12-11 15:30:41.793738', 'user-conn-user1-demo');
INSERT INTO public.contract_definitions VALUES ('contract_006', 'time_policy', 'time_policy', '[{"operator": "in", "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id", "operandRight": ["ML_model_004"]}]', '2025-12-12 00:32:56.458552', '2025-12-12 00:32:56.458552', 'user-conn-user1-demo');
INSERT INTO public.contract_definitions VALUES ('contract-iris-http-1765535248', 'policy-iris-http-1765535248', 'policy-iris-http-1765535248', '[{"operator": "=", "operandLeft": "id", "operandRight": "iris-http-1765535248"}]', '2025-12-12 10:27:28.507182', '2025-12-12 10:27:28.507182', 'user-conn-user1-demo');
INSERT INTO public.contract_definitions VALUES ('contract-iris-http-1765537190', 'policy-iris-http-1765537190', 'policy-iris-http-1765537190', '[{"operator": "=", "operandLeft": "id", "operandRight": "iris-http-1765537190"}]', '2025-12-12 10:59:50.807482', '2025-12-12 10:59:50.807482', 'user-conn-user1-demo');
INSERT INTO public.contract_definitions VALUES ('contract_001_ml', 'policy_002_ld', 'policy_002_ld', '[{"operator": "in", "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id", "operandRight": ["ml_model_010"]}]', '2025-12-12 13:02:15.527779', '2025-12-12 13:02:15.527779', 'user-conn-user1-demo');


--
-- Data for Name: data_addresses; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.data_addresses VALUES (1, 'ML_Model_001', 'AmazonS3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ml-assets', NULL, NULL, 'http://minio:9000', NULL, NULL, NULL, 'LGBM_Classifier_1.pkl', 'ML_Model_001/LGBM_Classifier_1.pkl', '2025-12-11 12:58:04.495868');
INSERT INTO public.data_addresses VALUES (2, 'ML_Model_002', 'AmazonS3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ml-assets', NULL, NULL, 'http://minio:9000', NULL, NULL, NULL, 'LGBM_Classifier_1.pkl', 'ML_Model_002/LGBM_Classifier_1.pkl', '2025-12-11 13:07:56.696001');
INSERT INTO public.data_addresses VALUES (3, 'ML_Model_003', 'AmazonS3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ml-assets', NULL, NULL, 'http://minio:9000', NULL, NULL, NULL, 'LGBM_Classifier_1.pkl', 'ML_Model_003/LGBM_Classifier_1.pkl', '2025-12-11 17:31:14.772751');
INSERT INTO public.data_addresses VALUES (4, 'ML_model_004', 'AmazonS3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ml-assets', NULL, NULL, 'http://minio:9000', NULL, NULL, NULL, 'LGBM_Classifier_1.pkl', 'ML_model_004/LGBM_Classifier_1.pkl', '2025-12-11 17:44:08.454517');
INSERT INTO public.data_addresses VALUES (5, 'ML_model_005', 'AmazonS3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ml-assets', NULL, NULL, 'http://minio:9000', NULL, NULL, NULL, 'LGBM_Classifier_1.pkl', 'ML_model_005/LGBM_Classifier_1.pkl', '2025-12-11 17:53:43.153938');
INSERT INTO public.data_addresses VALUES (7, 'iris-http-1765537190', 'HttpData', 'iris-classifier-http-endpoint', 'http://localhost:8080', '/download/iris-classifier-v1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 10:59:50.678751');
INSERT INTO public.data_addresses VALUES (8, '4dfe6d9e-c47d-4a5b-921a-32b762a3f564', 'DataAddress', NULL, 'http://localhost:8080/predict', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 12:33:00.148425');
INSERT INTO public.data_addresses VALUES (9, 'fdff25b6-66e4-40dd-9df1-6b6b6a8ebbb7', 'DataAddress', NULL, 'http://localhost:8080/predict', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 12:33:31.393474');
INSERT INTO public.data_addresses VALUES (10, 'af0c592f-4d11-4890-9d43-3627ab1b9218', 'DataAddress', NULL, 'http://localhost:8080/predict', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 12:37:26.187712');
INSERT INTO public.data_addresses VALUES (11, 'ml_model_010', 'DataSpacePrototypeStore', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 13:00:48.412292');
INSERT INTO public.data_addresses VALUES (12, 'ml_model_11', 'DataSpacePrototypeStore', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 13:27:38.621622');


--
-- Data for Name: ml_metadata; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.ml_metadata VALUES ('ML_Model_001', 'Image Classification', 'Object Detection', 'LGBM Classifier', NULL, NULL, 'LightGBM', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ML_Model_002', 'Regression', 'Time Series Prediction', 'LGBM Regressor', NULL, NULL, 'LightGBM', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ML_Model_003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ML_model_004', 'Regression', 'Linear Regression', 'LSTM', 'TensorFlow', 'TensorFlow', 'Python 3.12', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ML_model_005', 'Computer Vision', 'Image Classification', 'Transformer', 'PyTorch', 'PyTorch', 'Python 3.12', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('DL_Model_001', 'Classification', 'Image Classification', 'CNN', NULL, 'TensorFlow', 'Python 3.10', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('iris-http-1765537190', 'Classification', 'Multi-class Classification', 'Random Forest', 'scikit-learn', 'scikit-learn', 'Python', 'Python', 'MIT', NULL, '[{"max": 7.9, "min": 4.3, "mean": 5.843333333333334, "name": "sepal length (cm)", "type": "float", "position": 0, "description": "Sepal length in centimeters", "example_value": 5.1}, {"max": 4.4, "min": 2, "mean": 3.0573333333333337, "name": "sepal width (cm)", "type": "float", "position": 1, "description": "Sepal width in centimeters", "example_value": 3.5}, {"max": 6.9, "min": 1, "mean": 3.7580000000000005, "name": "petal length (cm)", "type": "float", "position": 2, "description": "Petal length in centimeters", "example_value": 1.4}, {"max": 2.5, "min": 0.1, "mean": 1.1993333333333336, "name": "petal width (cm)", "type": "float", "position": 3, "description": "Petal width in centimeters", "example_value": 0.2}]');
INSERT INTO public.ml_metadata VALUES ('af0c592f-4d11-4890-9d43-3627ab1b9218', 'classification', NULL, 'random-forest', 'scikit-learn', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ml_model_010', 'Natural Language Processing', 'Semantic Segmentation', 'BERT', 'PyTorch', 'PyTorch', 'Python 3.12', NULL, NULL, NULL, NULL);
INSERT INTO public.ml_metadata VALUES ('ml_model_11', 'Reinforcement Learning', 'Text Classification', 'GRU', 'Keras', 'Keras', 'Python 3.11', NULL, NULL, NULL, NULL);


--
-- Data for Name: policy_definitions; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.policy_definitions VALUES ('use-eu-policy', '{"@id": "use-eu-policy", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "EQ", "odrl:leftOperand": "BusinessPartnerNumber", "odrl:rightOperand": "EU"}]}]}', '2025-12-11 14:46:48.491759', '2025-12-11 14:46:48.491759', NULL);
INSERT INTO public.policy_definitions VALUES ('connector-restricted-policy', '{"@id": "connector-restricted-policy", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "EQ", "odrl:leftOperand": "DataspaceIdentifier", "odrl:rightOperand": "INESDATA"}]}]}', '2025-12-11 14:46:48.491759', '2025-12-11 14:46:48.491759', NULL);
INSERT INTO public.policy_definitions VALUES ('unrestricted-policy', '{"@id": "unrestricted-policy", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE"}]}', '2025-12-11 14:46:48.491759', '2025-12-11 14:46:48.491759', NULL);
INSERT INTO public.policy_definitions VALUES ('ID_POLICY_001', '{"@id": "ID_POLICY_001", "policy": {"@id": "ID_POLICY_001", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE"}]}, "@context": {"odrl": "http://www.w3.org/ns/odrl/2/", "@vocab": "https://w3id.org/edc/v0.0.1/ns/"}}', '2025-12-11 15:02:43.571703', '2025-12-11 15:02:43.571703', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('TIME_RESTRICTED_POLICY', '{"@id": "TIME_RESTRICTED_POLICY", "policy": {"@id": "TIME_RESTRICTED_POLICY", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "GEQ", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2025-01-01T00:00:00.000Z"}, {"odrl:operator": "LEQ", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2025-12-31T23:59:59.999Z"}]}]}, "@context": {"edc": "https://w3id.org/edc/v0.0.1/ns/"}}', '2025-12-11 15:35:31.274558', '2025-12-11 15:35:31.274558', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('ID_POLICY_WITH_CONSTRAINTS', '{"@id": "ID_POLICY_WITH_CONSTRAINTS", "policy": {"@id": "ID_POLICY_WITH_CONSTRAINTS", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "EQ", "odrl:leftOperand": "DataspaceIdentifier", "odrl:rightOperand": "DataSpacePrototype"}, {"odrl:operator": "EQ", "odrl:leftOperand": "PURPOSE", "odrl:rightOperand": "Research"}]}]}, "@context": {"edc": "https://w3id.org/edc/v0.0.1/ns/"}}', '2025-12-11 15:30:28.260211', '2025-12-11 15:44:46.887529', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('test-policy-001', '{"@type": "odrl:Set", "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": []}]}', '2025-12-12 00:23:48.464927', '2025-12-12 00:23:48.464927', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('test-policy-002', '{"@type": "odrl:Set", "odrl:permission": [{"odrl:action": "USE"}]}', '2025-12-12 00:23:58.419871', '2025-12-12 00:23:58.419871', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('time_policy', '{"@id": "time_policy", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "GT", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2025-12-15T23:00:00.000Z"}, {"odrl:operator": "LEQ", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2026-03-24T23:00:00.000Z"}]}]}', '2025-12-12 00:31:17.142866', '2025-12-12 00:31:17.142866', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('policy-iris-http-1765535248', '{"@type": "odrl:Set", "odrl:permission": [{"odrl:action": "USE"}]}', '2025-12-12 10:27:28.476492', '2025-12-12 10:27:28.476492', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('policy-iris-http-1765537190', '{"@type": "odrl:Set", "odrl:permission": [{"odrl:action": "USE"}]}', '2025-12-12 10:59:50.779035', '2025-12-12 10:59:50.779035', 'user-conn-user1-demo');
INSERT INTO public.policy_definitions VALUES ('policy_002_ld', '{"@id": "policy_002_ld", "@type": "PolicyDefinition", "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}], "odrl:permission": [{"odrl:action": "USE", "odrl:constraint": [{"odrl:operator": "GEQ", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2025-12-15T23:00:00.000Z"}, {"odrl:operator": "LEQ", "odrl:leftOperand": "POLICY_EVALUATION_TIME", "odrl:rightOperand": "2026-05-30T22:00:00.000Z"}]}]}', '2025-12-12 13:02:09.067957', '2025-12-12 13:02:09.067957', 'user-conn-user1-demo');


--
-- Data for Name: upload_chunks; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.upload_chunks VALUES (1, 1, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 12:58:04.353553');
INSERT INTO public.upload_chunks VALUES (2, 2, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 13:06:55.455912');
INSERT INTO public.upload_chunks VALUES (3, 3, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 13:07:56.546862');
INSERT INTO public.upload_chunks VALUES (4, 4, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 17:31:14.555175');
INSERT INTO public.upload_chunks VALUES (5, 5, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 17:44:08.275506');
INSERT INTO public.upload_chunks VALUES (6, 6, 0, '"af38fa28cece05b54fe88e44977de512"', '2025-12-11 17:53:42.974704');


--
-- Data for Name: upload_sessions; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.upload_sessions VALUES (1, 'ML_Model_001', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLmNiODY5MTVmLTUzNjktNGM4YS1hMTExLTg3YjVjYTI1ZDViOXgxNzY1NDU3ODg0Mjc1OTYwNTU3', 'completed', '2025-12-11 12:58:04.306624', '2025-12-11 12:58:04.495868', 'conn-user1-demo');
INSERT INTO public.upload_sessions VALUES (2, 'ML_Model_001', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLmExNWRhYjQ4LTJhZjEtNGFiMy04ZGU1LWMzYzUwYjRhZDJjY3gxNzY1NDU4NDE1MzkzOTkxNDgy', 'in_progress', '2025-12-11 13:06:55.408128', '2025-12-11 13:06:55.462571', 'conn-user1-demo');
INSERT INTO public.upload_sessions VALUES (3, 'ML_Model_002', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLjJmMTAzZjdhLWVlYmEtNGU3NS1iYjVlLWIzYjI0YjY1NjRiNngxNzY1NDU4NDc2NDc3MTU4NDE2', 'completed', '2025-12-11 13:07:56.492198', '2025-12-11 13:07:56.696001', 'conn-user1-demo');
INSERT INTO public.upload_sessions VALUES (4, 'ML_Model_003', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLmI1MjZlZjlhLTI0MDEtNDkzMS1hMjhhLWQyMWIwM2U0ODE4YXgxNzY1NDc0Mjc0NDYwOTExODA4', 'completed', '2025-12-11 17:31:14.495391', '2025-12-11 17:31:14.772751', 'conn-user1-demo');
INSERT INTO public.upload_sessions VALUES (5, 'ML_model_004', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLjdiYjk0YjhkLTJkMmYtNDIzYi04Mjk3LTQyYzMxYzY2NWE5MHgxNzY1NDc1MDQ4MTg4MDI4Mjcw', 'completed', '2025-12-11 17:44:08.222285', '2025-12-11 17:44:08.454517', 'conn-user1-demo');
INSERT INTO public.upload_sessions VALUES (6, 'ML_model_005', 'LGBM_Classifier_1.pkl', 1, 1, 'OGFhMWExNWEtMmJmMS00ZDU4LTkzMjQtYTk3MjNmZjRlYWMzLjAxMTE1Y2ExLWRlNDYtNDA5Yy05OWQ3LTJiOWM4NDVhNGU3ZngxNzY1NDc1NjIyODgxNzE3NTk1', 'completed', '2025-12-11 17:53:42.917684', '2025-12-11 17:53:43.153938', 'conn-user1-demo');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ml_assets_user
--

INSERT INTO public.users VALUES (3, 'user-conn-user1-demo', '$2a$10$I/m17k0PieyAy2M71CT9De3uVqv0mNft/yz.DmvGYrEZKAYc5qA1C', 'conn-user1-demo', 'User1 Demo', 'demo@oeg.fi.upm.es', true, '2025-12-12 16:41:21.765511', '2025-12-12 16:41:21.765511');
INSERT INTO public.users VALUES (4, 'user-conn-user2-demo', '$2a$10$4V9w.aXdEAcxU/ln6M7MHue25m6yjTeeJM1E3bkvEPj2XaSOa8M5.', 'conn-user2-demo', 'User2 Demo', 'edmundo@demo.com', true, '2025-12-12 16:41:21.765511', '2025-12-12 16:41:21.765511');


--
-- Name: data_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ml_assets_user
--

SELECT pg_catalog.setval('public.data_addresses_id_seq', 12, true);


--
-- Name: upload_chunks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ml_assets_user
--

SELECT pg_catalog.setval('public.upload_chunks_id_seq', 6, true);


--
-- Name: upload_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ml_assets_user
--

SELECT pg_catalog.setval('public.upload_sessions_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ml_assets_user
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: contract_definition_assets contract_definition_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_pkey PRIMARY KEY (contract_definition_id, asset_id);


--
-- Name: contract_definitions contract_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_pkey PRIMARY KEY (id);


--
-- Name: data_addresses data_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.data_addresses
    ADD CONSTRAINT data_addresses_pkey PRIMARY KEY (id);


--
-- Name: ml_metadata ml_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_pkey PRIMARY KEY (asset_id);


--
-- Name: policy_definitions policy_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.policy_definitions
    ADD CONSTRAINT policy_definitions_pkey PRIMARY KEY (id);


--
-- Name: upload_chunks upload_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_pkey PRIMARY KEY (id);


--
-- Name: upload_chunks upload_chunks_session_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_session_id_chunk_index_key UNIQUE (session_id, chunk_index);


--
-- Name: upload_sessions upload_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_connector_id_key; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_connector_id_key UNIQUE (connector_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_assets_created_at; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_assets_created_at ON public.assets USING btree (created_at DESC);


--
-- Name: idx_assets_owner; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_assets_owner ON public.assets USING btree (owner);


--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_assets_type ON public.assets USING btree (asset_type);


--
-- Name: idx_contract_definition_assets_asset_id; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_contract_definition_assets_asset_id ON public.contract_definition_assets USING btree (asset_id);


--
-- Name: idx_contract_definitions_access_policy; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_contract_definitions_access_policy ON public.contract_definitions USING btree (access_policy_id);


--
-- Name: idx_contract_definitions_contract_policy; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_contract_definitions_contract_policy ON public.contract_definitions USING btree (contract_policy_id);


--
-- Name: idx_contract_definitions_created_at; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_contract_definitions_created_at ON public.contract_definitions USING btree (created_at DESC);


--
-- Name: idx_data_addresses_asset_id; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_data_addresses_asset_id ON public.data_addresses USING btree (asset_id);


--
-- Name: idx_data_addresses_type; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_data_addresses_type ON public.data_addresses USING btree (type);


--
-- Name: idx_ml_metadata_algorithm; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_ml_metadata_algorithm ON public.ml_metadata USING btree (algorithm);


--
-- Name: idx_ml_metadata_input_features; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_ml_metadata_input_features ON public.ml_metadata USING gin (input_features);


--
-- Name: idx_ml_metadata_task; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_ml_metadata_task ON public.ml_metadata USING btree (task);


--
-- Name: idx_policy_definitions_created_at; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_policy_definitions_created_at ON public.policy_definitions USING btree (created_at DESC);


--
-- Name: idx_upload_sessions_asset_id; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_upload_sessions_asset_id ON public.upload_sessions USING btree (asset_id);


--
-- Name: idx_upload_sessions_owner; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_upload_sessions_owner ON public.upload_sessions USING btree (owner);


--
-- Name: idx_upload_sessions_status; Type: INDEX; Schema: public; Owner: ml_assets_user
--

CREATE INDEX idx_upload_sessions_status ON public.upload_sessions USING btree (status);


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: ml_assets_user
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contract_definitions update_contract_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: ml_assets_user
--

CREATE TRIGGER update_contract_definitions_updated_at BEFORE UPDATE ON public.contract_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: policy_definitions update_policy_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: ml_assets_user
--

CREATE TRIGGER update_policy_definitions_updated_at BEFORE UPDATE ON public.policy_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: upload_sessions update_upload_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: ml_assets_user
--

CREATE TRIGGER update_upload_sessions_updated_at BEFORE UPDATE ON public.upload_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contract_definition_assets contract_definition_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: contract_definition_assets contract_definition_assets_contract_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definition_assets
    ADD CONSTRAINT contract_definition_assets_contract_definition_id_fkey FOREIGN KEY (contract_definition_id) REFERENCES public.contract_definitions(id) ON DELETE CASCADE;


--
-- Name: contract_definitions contract_definitions_access_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_access_policy_id_fkey FOREIGN KEY (access_policy_id) REFERENCES public.policy_definitions(id) ON DELETE RESTRICT;


--
-- Name: contract_definitions contract_definitions_contract_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.contract_definitions
    ADD CONSTRAINT contract_definitions_contract_policy_id_fkey FOREIGN KEY (contract_policy_id) REFERENCES public.policy_definitions(id) ON DELETE RESTRICT;


--
-- Name: data_addresses data_addresses_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.data_addresses
    ADD CONSTRAINT data_addresses_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: ml_metadata ml_metadata_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: ml_metadata ml_metadata_asset_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.ml_metadata
    ADD CONSTRAINT ml_metadata_asset_id_fkey1 FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: upload_chunks upload_chunks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ml_assets_user
--

ALTER TABLE ONLY public.upload_chunks
    ADD CONSTRAINT upload_chunks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.upload_sessions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict tc4TUFTRReVJkSWi8I0ur9xGa4DDhYMpUtngFDNd9wPcRo3m1fahOqfpIJ0YYoE
