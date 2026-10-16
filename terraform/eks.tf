# EKS control plane + one managed node group in the private subnets.
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.29"

  name               = "${local.name}-eks"
  kubernetes_version = var.kubernetes_version

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  endpoint_public_access       = true
  endpoint_private_access      = true
  endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # Whoever runs `terraform apply` gets cluster-admin via an EKS access entry.
  authentication_mode                      = "API"
  enable_cluster_creator_admin_permissions = true
  enable_irsa                              = true

  addons = {
    vpc-cni = {
      before_compute = true # networking must exist before nodes join
    }
    coredns                = {}
    kube-proxy             = {}
    eks-pod-identity-agent = {}
    aws-ebs-csi-driver     = {} # dynamic EBS volumes for the PostgreSQL PVC
  }

  eks_managed_node_groups = {
    default = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = var.node_instance_types
      capacity_type  = var.node_capacity_type

      min_size     = var.node_min_size
      desired_size = var.node_desired_size
      max_size     = var.node_max_size

      disk_size = 30

      # Lets the EBS CSI driver use the node role (simplest option for a demo;
      # use IRSA / Pod Identity for the driver in production).
      iam_role_additional_policies = {
        ebs_csi = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
      }

      labels = {
        workload = "general"
      }
    }
  }

  access_entries = var.github_repository == "" ? {} : {
    github_actions = {
      principal_arn = aws_iam_role.github_actions[0].arn
      policy_associations = {
        admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }
}
