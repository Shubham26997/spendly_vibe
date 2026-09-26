# Spendly — Azure Deployment Guide

## 1. Overview

This document describes how Spendly was deployed to a Microsoft Azure Virtual Machine using Docker Compose and Nginx.

The purpose of this document is not only to describe the deployment process, but also to provide evidence that the application documented in this repository was deployed and tested in a cloud-hosted environment.

---

# 2. Deployment Architecture

The production-style deployment consists of the following components:

```text
                         Internet
                            │
                            ▼
                   Azure Public Endpoint
                            │
                            ▼
                    ┌───────────────┐
                    │     Nginx     │
                    │ Reverse Proxy │
                    └───────┬───────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
                  ▼                   ▼
          ┌──────────────┐     ┌──────────────┐
          │   Frontend   │     │   FastAPI    │
          │   Container  │     │   Container  │
          └──────────────┘     └──────┬───────┘
                                      │
                              ┌───────┴────────┐
                              │                │
                              ▼                ▼
                       ┌────────────┐   ┌────────────┐
                       │ PostgreSQL │   │ Gemini API │
                       └────────────┘   └────────────┘
```

---

# 3. Azure Infrastructure

Spendly was deployed to an Azure Virtual Machine.

### Infrastructure

| Component       | Purpose                                |
| --------------- | -------------------------------------- |
| Azure VM        | Hosts the application                  |
| Public IP / DNS | External application access            |
| NSG             | Controls inbound network traffic       |
| Docker          | Container runtime                      |
| Docker Compose  | Multi-container application management |
| Nginx           | Reverse proxy                          |
| PostgreSQL      | Application database                   |
| FastAPI         | Backend API                            |
| TypeScript/npm  | Frontend                               |
| Gemini API      | AI capabilities                        |

---

# 4. VM Deployment

The application source code was transferred to the Azure VM and deployed using Docker Compose.

The deployment process follows this general flow:

```text
Developer Machine
       │
       │ Git / Repository
       ▼
    Azure VM
       │
       ▼
 Docker Compose
       │
       ├── Frontend
       ├── Backend
       └── PostgreSQL
              │
              ▼
          Application
```

---

# 5. Docker Deployment

After connecting to the Azure VM, the application services were started using:

```bash
docker compose up -d
```

The running services can be inspected using:

```bash
docker compose ps
```

Logs can be inspected using:

```bash
docker compose logs
```

Individual service logs can also be inspected when troubleshooting.

---

# 6. Nginx Reverse Proxy

Nginx was configured as the public-facing reverse proxy.

Instead of exposing each internal application service independently, external requests enter through Nginx.

```text
Internet
   │
   ▼
Nginx
   │
   ├──► Frontend
   │
   └──► FastAPI API
```

This provides a single public entry point for the application and keeps the internal Docker services behind the reverse proxy.

---

# 7. Application Verification

After starting the Docker Compose stack, the application was verified through the Azure-hosted endpoint.

Verification included:

* Application accessibility
* Frontend functionality
* Backend API availability
* Database connectivity
* AI API integration
* Docker container status
* Nginx request routing

---

# 8. Deployment Evidence

The screenshots below are included as evidence of the cloud deployment.

## 8.1 Azure VM

![Azure VM](../screenshots/azure-vm.png)

This screenshot shows the Azure Virtual Machine used as the deployment host.

The Azure portal provides the infrastructure-level evidence that the application environment is running on an Azure VM.

---

## 8.2 Application Running

![Spendly Application](../screenshots/application.png)

This screenshot shows the Spendly application accessed through the deployed environment.

The application shown here was tested after the Docker Compose deployment on the Azure VM.

---

## 8.3 Docker Services

![Docker Services](../screenshots/docker-containers.png)

This screenshot shows the application containers running through Docker Compose on the deployment environment.

The containerized services correspond to the application architecture described above.

---

## 8.4 FastAPI Backend

![FastAPI](../screenshots/application-dashboard.png)

The FastAPI backend was deployed as a Docker container and accessed through the Nginx reverse proxy.

---

# 9. Establishing Deployment Authenticity

The screenshots in this repository are not intended to be presented as proof merely because they show the application UI.

The deployment evidence is established through the combination of:

```text
Azure VM
   │
   ├── Azure infrastructure screenshot
   │
   ├── Docker container screenshot
   │
   ├── Nginx configuration
   │
   ├── Application screenshot
   │
   └── Repository deployment configuration
```

Together, these demonstrate the relationship between the application and the cloud deployment environment.

The application source code and Docker configuration are available in this repository, while the Azure VM screenshot documents the cloud infrastructure used to host the deployment.

---

# 10. VM Cost Management

The Azure VM does not need to remain continuously active solely for portfolio purposes.

After completing deployment verification and capturing the required evidence, the VM can be deallocated when it is not required.

The project therefore maintains:

* Source code
* Docker configuration
* Nginx configuration
* Deployment instructions
* Architecture documentation
* Azure deployment evidence
* Application screenshots

even when the Azure compute resource is not actively running.

When another live demonstration is required, the VM can be started and the Docker Compose stack can be brought back online.

---

# 11. Reproducing the Deployment

The deployment can be reproduced by:

```text
1. Provision Azure VM
        ↓
2. Configure networking
        ↓
3. Install Docker
        ↓
4. Clone repository
        ↓
5. Configure environment variables
        ↓
6. Start Docker Compose
        ↓
7. Configure Nginx
        ↓
8. Verify application
```

This makes the deployment reproducible rather than dependent on the original VM.

---

# 12. Security Considerations

Sensitive information is intentionally excluded from the repository.

The following should never be committed:

```text
.env
API keys
database passwords
private SSH keys
Azure credentials
JWT secrets
other production credentials
```

Use `.env.example` to document the required configuration without exposing actual credentials.

---

# 13. Current Deployment State

The Azure VM is a demonstration/deployment environment rather than a permanently running production service.

To control cloud costs, the VM may be deallocated when it is not being actively demonstrated.

The repository therefore serves as the permanent project record containing the implementation, architecture, deployment configuration and evidence.
