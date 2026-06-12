# Agent Handoff

## Project Status
The **Jivdani Vegetable Suppliers (JVSapp)** application has been successfully deployed and seeded.

- **Deployment IP**: `45.196.196.114`
- **Current DB Status**: Seeding complete. The database has been successfully initialized with:
  - Admin User: `admin@jivdani.com` / `admin123`
  - 18 default vegetables.
- **Access Credentials**: Standard SSH access via root with password (configured on host).

## Key Modifications & Configuration
1. **MongoDB AVX Fix**: The deployment server does not support CPU AVX instructions. The database service in `docker-compose.yml` was downgraded from `mongo:7` to `mongo:4.4` to support non-AVX CPUs.
2. **Yarn Build Limits**: Configured `NODE_OPTIONS="--max-old-space-size=2048"` and adjusted dependencies in `Dockerfile.frontend` to ensure builds complete without timeouts/OOM on low-spec server hardware.
3. **Environment Template**: `.env.example` has been created for baseline environment variables.
4. **Deploy Script**: `deploy.sh` is available in the root folder to pull changes, tear down active containers, and build & restart services.

## Next Steps for Future Work
- **Deploying Future Updates**: Commit and push changes to the main GitHub repository. Log in to the remote server via SSH, navigate to `/root/JVSapp`, and run `./deploy.sh`.
- **Verify Backend**: Check logs with `docker-compose logs -f backend`.
- **Verify Database**: Check logs with `docker-compose logs -f mongo`.
