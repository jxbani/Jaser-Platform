# Convenience entry-points for the VMware deployment scripts.
# Usage: make -C infra/vmware <target>

SHELL := /bin/bash
ENV   ?= env/.env.shared
ROOT  := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: help build provision deploy rollback scale-out snapshot health lint

help:
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

build:           ## Build a production tarball (dist/jaser-*.tar.gz)
	$(ROOT)/scripts/build.sh

provision:       ## Clone the web/app/db VMs from templates via govc
	ENV_FILE=$(ROOT)/$(ENV) $(ROOT)/govc/provision.sh

deploy:          ## Roll a tarball out to the app tier (TARBALL=dist/...)
	@test -n "$$TARBALL" || (echo 'TARBALL=... required'; exit 1)
	ENV_FILE=$(ROOT)/$(ENV) $(ROOT)/scripts/deploy.sh $$TARBALL

rollback:       ## Symlink-swap rollback on the app tier
	ENV_FILE=$(ROOT)/$(ENV) $(ROOT)/scripts/rollback.sh

scale-out:       ## Add a new app VM (HOST=jaser-app-03)
	@test -n "$$HOST" || (echo 'HOST=... required'; exit 1)
	ENV_FILE=$(ROOT)/$(ENV) $(ROOT)/scripts/scale-out.sh $$HOST

snapshot:        ## Snapshot a single VM (VM=jaser-app-01 [LABEL=tag])
	@test -n "$$VM" || (echo 'VM=... required'; exit 1)
	ENV_FILE=$(ROOT)/$(ENV) $(ROOT)/govc/snapshot.sh create $$VM $${LABEL:-}

health:          ## Probe /api/health on every app host
	@ENV_FILE=$(ROOT)/$(ENV); source $$ENV_FILE; \
	 for h in $$APP_HOSTS; do $(ROOT)/scripts/health-check.sh $$h; done

lint:            ## shellcheck every script in this tree
	shellcheck $(ROOT)/scripts/*.sh $(ROOT)/govc/*.sh $(ROOT)/guest-customization/*.sh $(ROOT)/postgres/init-db.sh
